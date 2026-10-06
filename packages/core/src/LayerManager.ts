import type { InspectionEvent, Observer, SnapshotFrom } from 'xstate';
import type { LayerManagerAdapter, LayerManagerHooks, ManagedLayerInfo } from './adapters/types';

import type { LayerManagerActor } from './layerManagerMachines/layerManagerMachine';
import type { AddGroupLayerParams, AddLayerParams, LayerActor, LayerManagerContext, LayerTimeInfo, ManagedItem, MoveLayerTarget } from './types';
import { createActor } from 'xstate';
import { createLayerManagerMachine } from './layerManagerMachines/layerManagerMachine';
import { findLayerPlacement, findManagedLayerById } from './utils';

// ============================================================================
// OPTIONS
// ============================================================================

export interface LayerManagerOptions<TLayer, TGroup = undefined> extends LayerManagerHooks<TLayer, TGroup> {
  /** Allow layer groups to be nested inside other layer groups. */
  allowNestedGroupLayers?: boolean;
  /** Receives XState inspection events, e.g. `createBrowserInspector().inspect` from `@statelyai/inspect`. */
  inspect?: Observer<InspectionEvent> | ((inspectionEvent: InspectionEvent) => void);
  /** Called when a change is rejected, such as an unknown layer ID or an opacity outside 0 to 1. `error.message` says why. */
  onError?: (error: Error) => void;
}

/** The layer tree: every layer and group as plain data. Treat it as read-only: the manager replaces it on each change. */
export interface LayerTree<TLayer, TGroup = undefined> {
  /** The IDs of the top-level layers and groups, bottom first. */
  readonly rootIds: readonly string[];
  /** Every layer and group by ID. */
  readonly layers: Readonly<Record<string, ManagedLayerInfo<TLayer, TGroup>>>;
}

// ============================================================================
// LAYER MANAGER CLASS
// Primary public API. Read the layer tree, and change layers through these methods.
// ============================================================================

/**
 * Framework-agnostic manager for an ordered collection of layers and layer groups.
 *
 * `TLayer` is the layer data type and `TGroup` the group data type, which defaults to `undefined`.
 * Changes are reported to the optional {@link LayerManagerAdapter} and to the callbacks in
 * {@link LayerManagerOptions}, and can be read at any time with {@link getTree}.
 */
export class LayerManager<TLayer, TGroup = undefined> {
  private readonly _actor: LayerManagerActor<TLayer, TGroup>;
  private readonly _options: LayerManagerOptions<TLayer, TGroup>;
  private _adapter: LayerManagerAdapter<TLayer, TGroup> | null = null;
  /** Cleanup functions for each active XState actor event subscription. */
  private readonly _subscriptions: Array<() => void> = [];
  private _destroyed = false;
  /** The last tree, with the XState snapshots it was built from. */
  private _cache: {
    managerSnapshot: SnapshotFrom<LayerManagerActor<TLayer, TGroup>>;
    layerSnapshots: SnapshotFrom<LayerActor<TLayer, TGroup>>[];
    tree: LayerTree<TLayer, TGroup>;
  } | null = null;

  /** Each layer's info, keyed by the XState snapshot it was built from. */
  private readonly _infos = new WeakMap<SnapshotFrom<LayerActor<TLayer, TGroup>>, ManagedLayerInfo<TLayer, TGroup>>();

  constructor(options: LayerManagerOptions<TLayer, TGroup> = {}) {
    this._options = options;
    this._actor = createActor(createLayerManagerMachine<TLayer, TGroup>(), {
      input: { allowNestedGroupLayers: this._options.allowNestedGroupLayers ?? false },
      inspect: this._options.inspect,
    });
    this.start();
  }

  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------

  /**
   * The manager's XState actor, for working with the layer and group actors directly,
   * for example with `useSelector` from `@xstate/react`. See "Working with XState" in the docs.
   */
  get actor(): LayerManagerActor<TLayer, TGroup> {
    return this._actor;
  }

  /** `true` after {@link destroy} has been called. The instance cannot be reused once destroyed. */
  get destroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Returns the layer tree: every layer and group as plain data, read from the XState snapshots.
   * The same object is returned until something changes, and a layer that did not change keeps the
   * same info object, so it suits `useSyncExternalStore`.
   */
  getTree = (): LayerTree<TLayer, TGroup> => {
    const managerSnapshot = this._actor.getSnapshot();
    const { layers } = managerSnapshot.context;
    const cache = this._cache;
    // The same manager snapshot holds the same layers, so only each layer's own snapshot can differ.
    if (cache?.managerSnapshot === managerSnapshot && layers.every((managed, index) => managed.layerActor.getSnapshot() === cache.layerSnapshots[index])) {
      return cache.tree;
    }
    const tree = this._selectTree(managerSnapshot.context);
    this._cache = { managerSnapshot, layerSnapshots: layers.map((managed) => managed.layerActor.getSnapshot()), tree };
    return tree;
  };

  /**
   * Calls `listener` whenever the manager handles an event, so a reader can call `getTree()` again.
   * Every change to a layer reaches the manager as an event, so this covers layer changes too.
   * Returns a function that stops the calls.
   */
  subscribe = (listener: () => void): (() => void) => {
    const subscription = this._actor.subscribe(() => listener());
    return () => subscription.unsubscribe();
  };

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /** Starts the XState actor and wires event subscriptions. */
  private start(): void {
    this._actor.start();
    this._wireSubscriptions();
  }

  /** Resets layer state, unregisters the adapter, cancels all subscriptions, and stops the actor. */
  destroy(): void {
    if (this._destroyed) {
      return;
    }
    this._cleanupSubscriptions();
    this._adapter?.unregister?.();
    this.reset();
    this._actor.stop();
    this._destroyed = true;
  }

  /** Removes all layers and groups, returning the manager to its initial empty state. */
  reset(): void {
    this._actor.send({ type: 'RESET' });
  }

  // --------------------------------------------------------------------------
  // Adapter
  // --------------------------------------------------------------------------

  /**
   * Attach or replace the adapter at any time.
   * Pass `null` to detach the current adapter.
   */
  setAdapter(adapter: LayerManagerAdapter<TLayer, TGroup> | null): void {
    if (this._destroyed) {
      if (adapter) {
        this._options.onError?.(new Error('The manager is destroyed. Adapter not attached.'));
      }
      return;
    }
    this._adapter?.unregister?.();
    this._adapter = adapter;
    if (adapter) {
      this._registerAdapter(adapter);
    }
  }

  // --------------------------------------------------------------------------
  // Layer operations
  // --------------------------------------------------------------------------

  /** Adds a single layer to the manager. */
  addLayer(params: AddLayerParams<TLayer>): void {
    this._actor.send({ type: 'LAYER.ADD', params });
  }

  /** Adds a layer group to the manager. */
  addGroup(params: AddGroupLayerParams<TGroup>): void {
    this._actor.send({ type: 'LAYER.ADD', params });
  }

  /** Removes the layer or group with the given `layerId`. */
  removeLayer(layerId: string): void {
    this._actor.send({ type: 'LAYER.REMOVE', layerId });
  }

  /**
   * Moves the layer or group with the given `layerId` to `target.parentId` (`null` for the top level).
   * `target.index` counts from the bottom (0) and takes precedence over `target.position`, which defaults to `'bottom'`.
   */
  moveLayer(layerId: string, target: MoveLayerTarget): void {
    this._actor.send({ type: 'LAYER.MOVE', layerId, ...target });
  }

  /** Moves the layer or group with the given `layerId` one step towards the top of its parent. Does nothing at the top. */
  raiseLayer(layerId: string): void {
    const placement = findLayerPlacement(this._actor.getSnapshot().context, layerId);
    if (!placement) {
      this._options.onError?.(new Error(`Unable to find layer ${layerId}. Layer not moved.`));
      return;
    }
    if (placement.index === placement.siblingCount - 1) {
      return;
    }
    this.moveLayer(layerId, { parentId: placement.parentId, index: placement.index + 1 });
  }

  /** Moves the layer or group with the given `layerId` one step towards the bottom of its parent. Does nothing at the bottom. */
  lowerLayer(layerId: string): void {
    const placement = findLayerPlacement(this._actor.getSnapshot().context, layerId);
    if (!placement) {
      this._options.onError?.(new Error(`Unable to find layer ${layerId}. Layer not moved.`));
      return;
    }
    if (placement.index === 0) {
      return;
    }
    this.moveLayer(layerId, { parentId: placement.parentId, index: placement.index - 1 });
  }

  /**
   * Switches the layer or group with the given `layerId` on or off.
   * A switched-on layer is visible only while every group above it is switched on.
   */
  setEnabled(layerId: string, enabled: boolean): void {
    const managed = this._find(layerId);
    if (!managed) {
      this._options.onError?.(new Error(`Unable to find layer ${layerId}. Layer not switched ${enabled ? 'on' : 'off'}.`));
      return;
    }
    managed.layerActor.send(enabled ? { type: 'LAYER.ENABLED' } : { type: 'LAYER.DISABLED' });
  }

  /**
   * Makes the layer or group with the given `layerId` visible, switching on it and every group above it.
   * Unlike `setEnabled`, this also shows a switched-on layer that a switched-off group is hiding.
   */
  showLayer(layerId: string): void {
    const managed = this._find(layerId);
    if (!managed) {
      this._options.onError?.(new Error(`Unable to find layer ${layerId}. Layer not shown.`));
      return;
    }
    managed.layerActor.send({ type: 'LAYER.SHOW' });
  }

  /** Sets the opacity (0–1) for the layer with the given `layerId`. */
  setOpacity(layerId: string, opacity: number): void {
    const managed = this._find(layerId);
    if (!managed) {
      this._options.onError?.(new Error(`Unable to find layer ${layerId}. Opacity not set.`));
      return;
    }
    managed.layerActor.send({ type: 'LAYER.SET_OPACITY', opacity });
  }

  /** Sets the time info for the layer with the given `layerId`. */
  setTimeInfo(layerId: string, timeInfo: LayerTimeInfo): void {
    const managed = this._find(layerId);
    if (!managed) {
      this._options.onError?.(new Error(`Unable to find layer ${layerId}. Time info not set.`));
      return;
    }
    managed.layerActor.send({ type: 'LAYER.SET_TIME_INFO', timeInfo });
  }

  /** Replaces the `layerData` payload for the layer or group with the given `layerId`. */
  updateLayerData(layerId: string, layerData: TLayer | TGroup): void {
    const managed = this._find(layerId);
    if (!managed) {
      this._options.onError?.(new Error(`Unable to find layer ${layerId}. Layer data not updated.`));
      return;
    }
    managed.layerActor.send({ type: 'LAYER.SET_LAYER_DATA', layerData: layerData as TLayer & TGroup });
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /** Subscribes to machine-emitted events and forwards them to the adapter and options callbacks. */
  private _wireSubscriptions(): void {
    const addedSub = this._actor.on('LAYER.ADDED', (event) => {
      const info = this.getTree().layers[event.layerId];
      if (!info) {
        return;
      }
      try {
        this._adapter?.onLayerAdded?.(info);
      } finally {
        this._options.onLayerAdded?.(info);
      }
    });
    this._subscriptions.push(() => addedSub.unsubscribe());

    const removedSub = this._actor.on('LAYER.REMOVED', (event) => {
      try {
        this._adapter?.onLayerRemoved?.(event.layerId);
      } finally {
        this._options.onLayerRemoved?.(event.layerId);
      }
    });
    this._subscriptions.push(() => removedSub.unsubscribe());

    const visibilitySub = this._actor.on('LAYER.VISIBILITY_CHANGED', (event) => {
      const info = this.getTree().layers[event.layerId];
      if (!info) {
        return;
      }
      try {
        this._adapter?.onVisibilityChanged?.(info, event.visible);
      } finally {
        this._options.onVisibilityChanged?.(info, event.visible);
      }
    });
    this._subscriptions.push(() => visibilitySub.unsubscribe());

    const enabledSub = this._actor.on('LAYER.ENABLED_CHANGED', (event) => {
      const info = this.getTree().layers[event.layerId];
      if (!info) {
        return;
      }
      try {
        this._adapter?.onEnabledChanged?.(info, event.enabled);
      } finally {
        this._options.onEnabledChanged?.(info, event.enabled);
      }
    });
    this._subscriptions.push(() => enabledSub.unsubscribe());

    const opacitySub = this._actor.on('LAYER.OPACITY_CHANGED', (event) => {
      const info = this.getTree().layers[event.layerId];
      if (!info) {
        return;
      }
      try {
        this._adapter?.onOpacityChanged?.(info, event.computedOpacity);
      } finally {
        this._options.onOpacityChanged?.(info, event.computedOpacity);
      }
    });
    this._subscriptions.push(() => opacitySub.unsubscribe());

    const timeInfoSub = this._actor.on('LAYER.TIME_INFO_CHANGED', (event) => {
      const info = this.getTree().layers[event.layerId];
      if (!info) {
        return;
      }
      try {
        this._adapter?.onTimeInfoChanged?.(info, event.timeInfo);
      } finally {
        this._options.onTimeInfoChanged?.(info, event.timeInfo);
      }
    });
    this._subscriptions.push(() => timeInfoSub.unsubscribe());

    const layerDataSub = this._actor.on('LAYER.LAYER_DATA_CHANGED', (event) => {
      const info = this.getTree().layers[event.layerId];
      if (!info) {
        return;
      }
      try {
        this._adapter?.onLayerDataChanged?.(info);
      } finally {
        this._options.onLayerDataChanged?.(info);
      }
    });
    this._subscriptions.push(() => layerDataSub.unsubscribe());

    const orderSub = this._actor.on('LAYER.ORDER_CHANGED', (event) => {
      try {
        this._adapter?.onOrderChanged?.(event.layerOrder);
      } finally {
        this._options.onOrderChanged?.(event.layerOrder);
      }
    });
    this._subscriptions.push(() => orderSub.unsubscribe());

    const movedSub = this._actor.on('LAYER.MOVED', (event) => {
      const info = this.getTree().layers[event.layerId];
      if (!info) {
        return;
      }
      try {
        this._adapter?.onLayerMoved?.(info);
      } finally {
        this._options.onLayerMoved?.(info);
      }
    });
    this._subscriptions.push(() => movedSub.unsubscribe());

    const rejectedSub = this._actor.on('LAYER.REJECTED', (event) => {
      this._options.onError?.(new Error(event.reason));
    });
    this._subscriptions.push(() => rejectedSub.unsubscribe());
  }

  /** Builds the tree from the manager context, reusing each layer's info while its XState snapshot is unchanged. */
  private _selectTree(context: LayerManagerContext<TLayer, TGroup>): LayerTree<TLayer, TGroup> {
    const layers: Record<string, ManagedLayerInfo<TLayer, TGroup>> = {};
    for (const managed of context.layers) {
      const layerSnapshot = managed.layerActor.getSnapshot();
      const info = this._infos.get(layerSnapshot) ?? toInfo(managed);
      this._infos.set(layerSnapshot, info);
      layers[info.layerId] = info;
    }
    const previous = this._cache?.tree;
    const rootIds = previous && sameItems(previous.rootIds, context.childLayerOrder) ? previous.rootIds : [...context.childLayerOrder];
    return { rootIds, layers };
  }

  /** The layer's or group's actor, to send it a command. */
  private _find(layerId: string): ManagedItem<TLayer, TGroup> | undefined {
    return findManagedLayerById(this._actor.getSnapshot().context.layers, layerId);
  }

  private _cleanupSubscriptions(): void {
    for (const unsub of this._subscriptions) {
      unsub();
    }
    this._subscriptions.length = 0;
  }

  private _registerAdapter(adapter: LayerManagerAdapter<TLayer, TGroup>): void {
    adapter.register?.();
    const { rootIds, layers } = this.getTree();
    const layerOrder = flattenIds(rootIds, layers);
    for (const layerId of layerOrder) {
      const info = layers[layerId];
      if (info) {
        adapter.onLayerAdded?.(info);
      }
    }
    adapter.onOrderChanged?.(layerOrder);
  }
}

/**
 * Builds one layer's or group's info from its actor's snapshot alone. The manager sets the parent ref
 * and a group's child order, so they already hold the layer's place in the tree.
 */
function toInfo<TLayer, TGroup>(managed: ManagedItem<TLayer, TGroup>): ManagedLayerInfo<TLayer, TGroup> {
  const snapshot = managed.layerActor.getSnapshot();
  const { layerId, layerName, opacity, computedOpacity, timeInfo, parentRef } = snapshot.context;
  const common = {
    layerId,
    layerName,
    opacity,
    computedOpacity,
    timeInfo,
    enabled: snapshot.hasTag('enabled'),
    visible: snapshot.hasTag('visible'),
    parentId: parentRef?.id ?? null,
  };
  if (managed.type === 'layer') {
    const { layerData, listMode } = managed.layerActor.getSnapshot().context;
    return { ...common, layerType: 'layer', layerData, listMode };
  }
  const { layerData, listMode, childLayerOrder } = managed.layerActor.getSnapshot().context;
  return { ...common, layerType: 'layerGroup', layerData, listMode, childIds: [...childLayerOrder] };
}

function sameItems(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/** Every ID from the given ones down, each group followed by its children, bottom first. */
function flattenIds<TLayer, TGroup>(ids: readonly string[], layers: LayerTree<TLayer, TGroup>['layers']): string[] {
  return ids.flatMap((id) => {
    const info = layers[id];
    return [id, ...(info?.layerType === 'layerGroup' ? flattenIds(info.childIds, layers) : [])];
  });
}
