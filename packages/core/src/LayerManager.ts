import type { InspectionEvent, Observer } from 'xstate';
import type { LayerManagerAdapter, LayerManagerCallbacks, ManagedLayerInfo } from './adapters/types';

import type { LayerManagerActor } from './layerManagerMachines/layerManagerMachine';
import type { AddGroupLayerParams, AddLayerParams, LayerTimeInfo, ManagedItem, MoveLayerTarget } from './types';
import { createActor } from 'xstate';
import { createLayerManagerMachine } from './layerManagerMachines/layerManagerMachine';
import { isLayerMachine } from './types';
import { findLayerPlacement, findManagedLayerById, getFlatLayerOrder, getTopLevelLayersInOrder } from './utils';

// ============================================================================
// OPTIONS
// ============================================================================

export interface LayerManagerOptions<TLayer, TGroup = TLayer> {
  /** Allow layer groups to be nested inside other layer groups. */
  allowNestedGroupLayers?: boolean;
  /** Receives XState inspection events, e.g. `createBrowserInspector().inspect` from `@statelyai/inspect`. */
  inspect?: Observer<InspectionEvent> | ((inspectionEvent: InspectionEvent) => void);
  /** Called whenever a new layer is added. */
  onLayerAdded?: (info: ManagedLayerInfo<TLayer, TGroup>) => void;
  /** Called whenever a layer is removed. */
  onLayerRemoved?: (layerId: string) => void;
  /** Called whenever a layer's visibility changes. */
  onVisibilityChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, visible: boolean) => void;
  /** Called whenever a layer or group is switched on or off, even while a group above hides it. */
  onEnabledChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, enabled: boolean) => void;
  /** Called whenever a layer's computed opacity changes. */
  onOpacityChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, computedOpacity: number) => void;
  /** Called whenever a layer's time info changes. */
  onTimeInfoChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, timeInfo: LayerTimeInfo) => void;
  /** Called whenever a layer's data payload changes. */
  onLayerDataChanged?: (info: ManagedLayerInfo<TLayer, TGroup>) => void;
  /** Called whenever a layer or group is moved, with `info.parentId` set to its new parent. */
  onLayerMoved?: (info: ManagedLayerInfo<TLayer, TGroup>) => void;
  /** Called whenever the layer order changes, with every layer ID from bottom to top. */
  onOrderChanged?: (layerOrder: string[]) => void;
  /** Called when an internal error occurs. */
  onError?: (error: Error) => void;
}

// ============================================================================
// LAYER MANAGER CLASS
// Primary public API. The XState machine is an implementation detail.
// ============================================================================

/**
 * Framework-agnostic manager for an ordered collection of layers and layer groups.
 *
 * `TLayer` is the consumer's layer data type; `TGroup` is the group data type
 * (defaults to `TLayer` when omitted). Lifecycle events are forwarded to both
 * the optional {@link LayerManagerAdapter} and the callbacks in
 * {@link LayerManagerOptions}.
 */
export class LayerManager<TLayer, TGroup = undefined> {
  private readonly _actor: LayerManagerActor<TLayer, TGroup>;
  private readonly _options: LayerManagerOptions<TLayer, TGroup>;
  private _adapter: LayerManagerAdapter<TLayer, TGroup> | null = null;
  /** Cleanup functions for each active XState actor event subscription. */
  private readonly _subscriptions: Array<() => void> = [];
  private _destroyed = false;

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
   * Escape hatch for `@xstate/react` integration (e.g. `useSelector`).
   * Prefer the typed methods on this class for all other use cases.
   */
  get actor(): LayerManagerActor<TLayer, TGroup> {
    return this._actor;
  }

  /** `true` while the underlying XState actor is running (i.e. not yet stopped). */
  get isReady(): boolean {
    return this._actor.getSnapshot().status === 'active';
  }

  /** `true` after {@link destroy} has been called. The instance cannot be reused once destroyed. */
  get destroyed(): boolean {
    return this._destroyed;
  }

  /** The current top-level layers in their display order. */
  get layers(): ManagedItem<TLayer, TGroup>[] {
    const { childLayerOrder, layers } = this._actor.getSnapshot().context;
    return getTopLevelLayersInOrder(childLayerOrder, layers);
  }

  /** Returns the managed item for `id`, or `undefined` if it does not exist. */
  getLayer(id: string): ManagedItem<TLayer, TGroup> | undefined {
    const { layers } = this._actor.getSnapshot().context;
    return findManagedLayerById(layers, id);
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /** Starts the XState actor, wires event subscriptions, and registers any pending adapter. */
  private start(): void {
    this._actor.start();
    this._wireSubscriptions();
    if (this._adapter) {
      this._registerAdapter(this._adapter);
    }
  }

  /**
   * Alias for {@link destroy}.
   * @internal
   */
  stop(): void {
    this.destroy();
  }

  /** Resets layer state, unregisters the adapter, cancels all subscriptions, and stops the actor. */
  destroy(): void {
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
    this._adapter?.unregister?.();
    this._adapter = adapter;
    if (adapter && this.isReady) {
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
    const managed = this.getLayer(layerId);
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
    const managed = this.getLayer(layerId);
    if (!managed) {
      this._options.onError?.(new Error(`Unable to find layer ${layerId}. Layer not shown.`));
      return;
    }
    managed.layerActor.send({ type: 'LAYER.SHOW' });
  }

  /** Sets the opacity (0–1) for the layer with the given `layerId`. */
  setOpacity(layerId: string, opacity: number): void {
    const managed = this.getLayer(layerId);
    if (!managed) {
      this._options.onError?.(new Error(`Unable to find layer ${layerId}. Opacity not set.`));
      return;
    }
    managed.layerActor.send({ type: 'LAYER.SET_OPACITY', opacity });
  }

  /** Sets the time info for the layer with the given `layerId`. */
  setTimeInfo(layerId: string, timeInfo: LayerTimeInfo): void {
    const managed = this.getLayer(layerId);
    if (!managed) {
      this._options.onError?.(new Error(`Unable to find layer ${layerId}. Time info not set.`));
      return;
    }
    managed.layerActor.send({ type: 'LAYER.SET_TIME_INFO', timeInfo });
  }

  /** Replaces the `layerData` payload for the layer or group with the given `layerId`. */
  updateLayerData(layerId: string, layerData: TLayer | TGroup): void {
    const managed = this.getLayer(layerId);
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
      const info = this._toManagedLayerInfo(event.layerId, event.visible);
      if (!info) {
        return;
      }
      this._adapter?.onLayerAdded?.(info);
      this._options.onLayerAdded?.(info);
    });
    this._subscriptions.push(() => addedSub.unsubscribe());

    const removedSub = this._actor.on('LAYER.REMOVED', (event) => {
      this._adapter?.onLayerRemoved?.(event.layerId);
      this._options.onLayerRemoved?.(event.layerId);
    });
    this._subscriptions.push(() => removedSub.unsubscribe());

    const visibilitySub = this._actor.on('LAYER.VISIBILITY_CHANGED', (event) => {
      const info = this._toManagedLayerInfo(event.layerId, event.visible);
      if (!info) {
        return;
      }
      this._adapter?.onVisibilityChanged?.(info, event.visible);
      this._options.onVisibilityChanged?.(info, event.visible);
    });
    this._subscriptions.push(() => visibilitySub.unsubscribe());

    const enabledSub = this._actor.on('LAYER.ENABLED_CHANGED', (event) => {
      const info = this._toManagedLayerInfo(event.layerId);
      if (!info) {
        return;
      }
      this._adapter?.onEnabledChanged?.(info, event.enabled);
      this._options.onEnabledChanged?.(info, event.enabled);
    });
    this._subscriptions.push(() => enabledSub.unsubscribe());

    const opacitySub = this._actor.on('LAYER.OPACITY_CHANGED', (event) => {
      const info = this._toManagedLayerInfo(event.layerId);
      if (!info) {
        return;
      }
      this._adapter?.onOpacityChanged?.(info, event.computedOpacity);
      this._options.onOpacityChanged?.(info, event.computedOpacity);
    });
    this._subscriptions.push(() => opacitySub.unsubscribe());

    const timeInfoSub = this._actor.on('LAYER.TIME_INFO_CHANGED', (event) => {
      const info = this._toManagedLayerInfo(event.layerId);
      if (!info) {
        return;
      }
      this._adapter?.onTimeInfoChanged?.(info, event.timeInfo);
      this._options.onTimeInfoChanged?.(info, event.timeInfo);
    });
    this._subscriptions.push(() => timeInfoSub.unsubscribe());

    const layerDataSub = this._actor.on('LAYER.LAYER_DATA_CHANGED', (event) => {
      const info = this._toManagedLayerInfo(event.layerId);
      if (!info) {
        return;
      }
      this._adapter?.onLayerDataChanged?.(info);
      this._options.onLayerDataChanged?.(info);
    });
    this._subscriptions.push(() => layerDataSub.unsubscribe());

    const orderSub = this._actor.on('LAYER.ORDER_CHANGED', (event) => {
      this._adapter?.onOrderChanged?.(event.layerOrder);
      this._options.onOrderChanged?.(event.layerOrder);
    });
    this._subscriptions.push(() => orderSub.unsubscribe());

    const movedSub = this._actor.on('LAYER.MOVED', (event) => {
      const info = this._toManagedLayerInfo(event.layerId);
      if (!info) {
        return;
      }
      this._adapter?.onLayerMoved?.(info);
      this._options.onLayerMoved?.(info);
    });
    this._subscriptions.push(() => movedSub.unsubscribe());

    const rejectedSub = this._actor.on('LAYER.REJECTED', (event) => {
      this._options.onError?.(new Error(event.reason));
    });
    this._subscriptions.push(() => rejectedSub.unsubscribe());
  }

  private _cleanupSubscriptions(): void {
    for (const unsub of this._subscriptions) {
      unsub();
    }
    this._subscriptions.length = 0;
  }

  private _registerAdapter(adapter: LayerManagerAdapter<TLayer, TGroup>): void {
    const callbacks: LayerManagerCallbacks<TLayer, TGroup> = {
      getSnapshot: () => this.layers,
      getLayer: (id) => this.getLayer(id),
    };
    adapter.register?.(this, callbacks);
    const layerOrder = getFlatLayerOrder(this._actor.getSnapshot().context);
    for (const layerId of layerOrder) {
      const info = this._toManagedLayerInfo(layerId);
      if (info) {
        adapter.onLayerAdded?.(info);
      }
    }
    adapter.onOrderChanged?.(layerOrder);
  }

  /**
   * Converts an internal XState actor context into the stable
   * {@link ManagedLayerInfo} shape exposed to adapters and option callbacks.
   * The `isLayerMachine` branch is required for TypeScript to narrow `ctx`
   * to the correct discriminated union member.
   */
  private _toManagedLayerInfo(layerId: string, visible?: boolean): ManagedLayerInfo<TLayer, TGroup> | null {
    const { layers } = this._actor.getSnapshot().context;
    const managed = findManagedLayerById(layers, layerId);
    if (!managed) {
      return null;
    }

    const snapshot = managed.layerActor.getSnapshot();
    const isEnabled = snapshot.hasTag('enabled');
    const isVisible = visible ?? snapshot.hasTag('visible');

    if (isLayerMachine(managed.layerActor)) {
      const ctx = managed.layerActor.getSnapshot().context;
      return {
        layerId: ctx.layerId,
        layerName: ctx.layerName,
        layerType: 'layer',
        layerData: ctx.layerData,
        opacity: ctx.opacity,
        computedOpacity: ctx.computedOpacity,
        enabled: isEnabled,
        visible: isVisible,
        timeInfo: ctx.timeInfo,
        listMode: ctx.listMode,
        parentId: ctx.parentRef?.getSnapshot().context.layerId ?? null,
      };
    } else {
      const ctx = managed.layerActor.getSnapshot().context;
      return {
        layerId: ctx.layerId,
        layerName: ctx.layerName,
        layerType: 'layerGroup',
        layerData: ctx.layerData,
        opacity: ctx.opacity,
        computedOpacity: ctx.computedOpacity,
        enabled: isEnabled,
        visible: isVisible,
        timeInfo: ctx.timeInfo,
        listMode: ctx.listMode,
        parentId: ctx.parentRef?.getSnapshot().context.layerId ?? null,
      };
    }
  }
}
