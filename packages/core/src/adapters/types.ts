import type { LayerTimeInfo } from '../types';

// ============================================================================
// ADAPTER LAYER INFO
// Stable, non-XState shape passed to adapter methods and consumer callbacks.
// ============================================================================
interface BaseLayerInfo<TData> {
  layerId: string;
  layerName: string;
  layerData: TData;
  /** The group the item is in, or `null` at the top level. */
  parentId: string | null;
  /** Whether the item is switched on. */
  enabled: boolean;
  /** Whether the item is showing: switched on, with every group above it showing. */
  visible: boolean;
  /** The item's own opacity, from 0 to 1. */
  opacity: number;
  /** The opacity combined with every group above it. Use this on the map. */
  computedOpacity: number;
  timeInfo?: LayerTimeInfo;
}

export interface LayerInfo<TLayer = unknown> extends BaseLayerInfo<TLayer> {
  layerType: 'layer';
  listMode: 'show' | 'hide';
}

export interface LayerGroupInfo<TGroup = undefined> extends BaseLayerInfo<TGroup> {
  layerType: 'layerGroup';
  listMode: 'show' | 'hide' | 'hide-children';
  /** The IDs of the group's children, bottom first. */
  childIds: string[];
}

export type ManagedLayerInfo<TLayer = unknown, TGroup = undefined> = LayerInfo<TLayer> | LayerGroupInfo<TGroup>;

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
