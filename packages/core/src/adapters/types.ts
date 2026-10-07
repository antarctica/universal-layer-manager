import type { LayerTimeInfo } from '../types';

// ============================================================================
// LAYER INFO
// A layer or group as plain data, passed to adapters and the options callbacks.
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
// LAYER TREE
// Every layer and group as plain data, read with LayerManager.getTree().
// ============================================================================

/** The layer tree: every layer and group as plain data. Treat it as read-only: the manager replaces it on each change. */
export interface LayerTree<TLayer, TGroup = undefined> {
  /** The IDs of the top-level layers and groups, bottom first. */
  readonly rootIds: readonly string[];
  /** Every layer and group by ID. */
  readonly layers: Readonly<Record<string, ManagedLayerInfo<TLayer, TGroup>>>;
}

// ============================================================================
// CHANGE HOOKS
// What the manager reports, both to an adapter and to the callbacks in LayerManagerOptions.
// ============================================================================

export interface LayerManagerHooks<TLayer = unknown, TGroup = undefined> {
  /** Called when a layer or group is added. */
  onLayerAdded?: (info: ManagedLayerInfo<TLayer, TGroup>) => void;

  /** Called when a layer or group is removed, including by `reset()`. */
  onLayerRemoved?: (layerId: string) => void;

  /** Called when a layer or group starts or stops showing. */
  onVisibilityChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, visible: boolean) => void;

  /** Called when a layer or group is switched on or off, even while a group above hides it. */
  onEnabledChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, enabled: boolean) => void;

  /** Called when a layer's or group's computed opacity changes. */
  onOpacityChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, computedOpacity: number) => void;

  /** Called when a layer's or group's time info changes. */
  onTimeInfoChanged?: (info: ManagedLayerInfo<TLayer, TGroup>, timeInfo: LayerTimeInfo) => void;

  /** Called when a layer's or group's `layerData` is replaced. */
  onLayerDataChanged?: (info: ManagedLayerInfo<TLayer, TGroup>) => void;

  /** Called when a layer or group is moved, with `info.parentId` set to its new parent. */
  onLayerMoved?: (info: ManagedLayerInfo<TLayer, TGroup>) => void;

  /** Called when the layer order changes, with every layer ID from bottom to top. */
  onOrderChanged?: (layerOrder: string[]) => void;
}

// ============================================================================
// ADAPTER CONTRACT
// The manager calls an adapter's hooks directly as layers change.
// ============================================================================

export interface LayerManagerAdapter<TLayer = unknown, TGroup = undefined> extends LayerManagerHooks<TLayer, TGroup> {
  /** Called by setAdapter() when the adapter is attached, before it is told about existing layers. */
  register?: () => void;

  /** Called by LayerManager.destroy() or setAdapter() when the adapter is detached or replaced, to clean up. */
  unregister?: () => void;
}
