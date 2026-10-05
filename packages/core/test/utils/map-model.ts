import type { LayerManagerAdapter, ManagedLayerInfo } from '../../src/adapters/types';
import type { LayerTimeInfo } from '../../src/types';

export interface MapLayerState<TData> {
  layerName: string;
  layerType: 'layer' | 'layerGroup';
  listMode: 'show' | 'hide' | 'hide-children';
  parentId: string | null;
  enabled: boolean;
  visible: boolean;
  opacity: number;
  computedOpacity: number;
  timeInfo?: LayerTimeInfo;
  layerData: TData;
}

/**
 * An adapter that records what a map would show, so tests can assert on
 * the outcome a consumer sees rather than on machine internals.
 */
export interface MapModel<TLayer, TGroup = TLayer> extends LayerManagerAdapter<TLayer, TGroup> {
  registered: boolean;
  readonly layers: Map<string, MapLayerState<TLayer | TGroup>>;
  order: string[];
  visibleLayerIds: () => string[];
}

export function createMapModel<TLayer, TGroup = TLayer>(): MapModel<TLayer, TGroup> {
  const layers = new Map<string, MapLayerState<TLayer | TGroup>>();

  const record = (info: ManagedLayerInfo<TLayer, TGroup>): void => {
    layers.set(info.layerId, {
      layerName: info.layerName,
      layerType: info.layerType,
      listMode: info.listMode,
      parentId: info.parentId,
      enabled: info.enabled,
      visible: info.visible,
      opacity: info.opacity,
      computedOpacity: info.computedOpacity,
      timeInfo: info.timeInfo,
      layerData: info.layerData,
    });
  };

  const model: MapModel<TLayer, TGroup> = {
    registered: false,
    layers,
    order: [],
    visibleLayerIds: () => [...layers].filter(([, layer]) => layer.visible).map(([layerId]) => layerId).sort(),
    register: () => {
      model.registered = true;
    },
    unregister: () => {
      model.registered = false;
      layers.clear();
    },
    onLayerAdded: record,
    onLayerRemoved: (layerId) => {
      layers.delete(layerId);
    },
    onVisibilityChanged: record,
    onEnabledChanged: record,
    onOpacityChanged: record,
    onTimeInfoChanged: record,
    onLayerDataChanged: record,
    onLayerMoved: record,
    onOrderChanged: (layerOrder) => {
      model.order = layerOrder;
    },
  };

  return model;
}
