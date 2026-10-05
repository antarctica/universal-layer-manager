import type { LayerContext, LayerGroupContext, LayerTimeInfo } from '../types';

// ============================================================================
// ADAPTER LAYER INFO
// Stable, non-XState shape passed to adapter methods and consumer callbacks.
// ============================================================================
export type LayerInfo<TLayer = unknown, TGroup = undefined> = Omit<LayerContext<TLayer, TGroup>, 'layerManagerRef' | 'parentRef' | 'startState' | 'parentOpacity'> & { enabled: boolean; visible: boolean; parentId: string | null };

export type LayerGroupInfo<TLayer = unknown, TGroup = undefined> = Omit<LayerGroupContext<TLayer, TGroup>, 'layerManagerRef' | 'parentRef' | 'children' | 'childLayerOrder' | 'startState' | 'parentOpacity'> & { enabled: boolean; visible: boolean; parentId: string | null };

export type ManagedLayerInfo<TLayer = unknown, TGroup = undefined> = LayerInfo<TLayer, TGroup> | LayerGroupInfo<TLayer, TGroup>;

// ============================================================================
// ADAPTER CONTRACT
// Terra-draw-style interface: LayerManager calls adapter methods directly.
// Adapters no longer subscribe to events; they receive them as method calls.
// ============================================================================

export interface LayerManagerAdapter<TLayer = unknown, TGroup = undefined> {
  /** Called by setAdapter() when the adapter is attached, before it is told about existing layers. */
  register?: () => void;

  /** Called by LayerManager.destroy() or setAdapter() when the adapter is detached or replaced, to clean up. */
  unregister?: () => void;

  /** Called when a new layer is added and ready. */
  onLayerAdded?: (info: ManagedLayerInfo<TLayer, TGroup>) => void;

  /** Called when a layer is removed. */
  onLayerRemoved?: (layerId: string) => void;

  /** Called when a layer's visibility changes. */
  onVisibilityChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, visible: boolean) => void;

  /** Called when a layer or group is switched on or off, even while a group above hides it. */
  onEnabledChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, enabled: boolean) => void;

  /** Called when a layer's computed opacity changes. */
  onOpacityChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, computedOpacity: number) => void;

  /** Called when a layer's time info is updated. */
  onTimeInfoChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, timeInfo: LayerTimeInfo) => void;

  /** Called when a layer's data payload is updated. */
  onLayerDataChanged?: (info: ManagedLayerInfo<TLayer, TGroup>) => void;

  /** Called when a layer or group is moved, with `info.parentId` set to its new parent. */
  onLayerMoved?: (info: ManagedLayerInfo<TLayer, TGroup>) => void;

  /** Called when the layer order changes, with every layer ID from bottom to top. */
  onOrderChanged?: (layerOrder: string[]) => void;
}
