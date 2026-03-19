import type { LayerManager } from '../LayerManager';
import type { LayerContext, LayerGroupContext, ManagedItem } from '../types';

// ============================================================================
// ADAPTER LAYER INFO
// Stable, non-XState shape passed to adapter methods and consumer callbacks.
// ============================================================================
export type LayerInfo<TLayer = unknown, TGroup = TLayer> = Omit<LayerContext<TLayer, TGroup>, 'layerManagerRef' | 'parentRef'> & { visible: boolean; parentId: string | null };

export type LayerGroupInfo<TLayer = unknown, TGroup = TLayer> = Omit<LayerGroupContext<TLayer, TGroup>, 'layerManagerRef' | 'parentRef' | 'children' | 'childLayerOrder'> & { visible: boolean; parentId: string | null };

export type ManagedLayerInfo<TLayer = unknown, TGroup = TLayer> = LayerInfo<TLayer, TGroup> | LayerGroupInfo<TLayer, TGroup>;

// ============================================================================
// ADAPTER CALLBACKS
// Functions the adapter can call back into the LayerManager.
// ============================================================================

export interface LayerManagerCallbacks<TLayer, TGroup> {
  /** Returns the current ordered top-level layer snapshot. */
  getSnapshot: () => ManagedItem<TLayer, TGroup>[];
  /** Returns a single managed item by ID, or undefined if not found. */
  getLayer: (id: string) => ManagedItem<TLayer, TGroup> | undefined;
}

// ============================================================================
// ADAPTER CONTRACT
// Terra-draw-style interface: LayerManager calls adapter methods directly.
// Adapters no longer subscribe to events; they receive them as method calls.
// ============================================================================

export interface LayerManagerAdapter<TLayer = unknown, TGroup = unknown> {
  /**
   * Called by LayerManager.start() (or setAdapter()) to give the adapter
   * a reference back into the manager for querying state.
   */
  register?: (layerManager: LayerManager<TLayer, TGroup>, callbacks: LayerManagerCallbacks<TLayer, TGroup>) => void;

  /** Called by LayerManager.dispose() or setAdapter(null) to clean up. */
  unregister?: () => void;

  /** Called when a new layer is added and ready. */
  onLayerAdded?: (info: ManagedLayerInfo<TLayer, TGroup>) => void;

  /** Called when a layer is removed. */
  onLayerRemoved?: (layerId: string) => void;

  /** Called when a layer's visibility changes. */
  onVisibilityChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, visible: boolean) => void;

  /** Called when a layer's computed opacity changes. */
  onOpacityChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, computedOpacity: number) => void;

  /** Called when a layer's data payload is updated. */
  onLayerDataChanged?: (info: ManagedLayerInfo<TLayer, TGroup>) => void;
}
