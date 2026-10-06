import type { InspectionEvent, Observer } from 'xstate';
import type { LayerManagerAdapter, LayerManagerHooks } from './adapters/types';

import type { LayerManagerActor } from './layerManagerMachines/layerManagerMachine';
import type { LayerTree } from './layerTree';
import type { AddGroupLayerParams, AddLayerParams, LayerTimeInfo, ManagedItem, MoveLayerTarget } from './types';
import { createActor } from 'xstate';
import { connectAdapter, connectHooks } from './connectAdapter';
import { createLayerManagerMachine } from './layerManagerMachines/layerManagerMachine';
import { createLayerTreeReader } from './layerTree';
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
  private _disconnectAdapter: (() => void) | null = null;
  private _disconnectCallbacks: () => void = () => {};
  private _destroyed = false;
  private readonly _readTree: () => LayerTree<TLayer, TGroup>;

  constructor(options: LayerManagerOptions<TLayer, TGroup> = {}) {
    this._options = options;
    this._actor = createActor(createLayerManagerMachine<TLayer, TGroup>(), {
      input: { allowNestedGroupLayers: this._options.allowNestedGroupLayers ?? false },
      inspect: this._options.inspect,
    });
    this._readTree = createLayerTreeReader(this._actor);
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
  getTree = (): LayerTree<TLayer, TGroup> => this._readTree();

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

  /** Starts the XState actor, and connects the options callbacks to it. */
  private start(): void {
    this._actor.start();
    this._connectCallbacks();
  }

  /** Resets layer state, unregisters the adapter, cancels all subscriptions, and stops the actor. */
  destroy(): void {
    if (this._destroyed) {
      return;
    }
    this._disconnectCallbacks();
    this._disconnectAdapter?.();
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
    this._disconnectAdapter?.();
    this._disconnectAdapter = adapter ? connectAdapter(this._actor, adapter) : null;
    // Connected again after the adapter, so the adapter hears about each change first.
    this._connectCallbacks();
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

  /** Connects the options callbacks, `onError` included, to the manager, replacing any earlier connection. */
  private _connectCallbacks(): void {
    this._disconnectCallbacks();
    const disconnectHooks = connectHooks(this._actor, this._options, this.getTree);
    const rejections = this._actor.on('LAYER.REJECTED', ({ reason }) => this._options.onError?.(new Error(reason)));
    this._disconnectCallbacks = () => {
      disconnectHooks();
      rejections.unsubscribe();
    };
  }

  /** The layer's or group's actor, to send it a command. */
  private _find(layerId: string): ManagedItem<TLayer, TGroup> | undefined {
    return findManagedLayerById(this._actor.getSnapshot().context.layers, layerId);
  }
}
