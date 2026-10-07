import type { LayerManagerAdapter, ManagedLayerInfo } from '@ulm/core';

import type { MapLibreMap } from 'maplibre-gl';
import type { LayerSpecification, MapLibreAdapterOptions, MapLibreLayerFactory, MapLibreLayerStyle } from './types';

// The prefix keeps runtime IDs clear of the basemap's.
const ID_PREFIX = 'ulm:';

function runtimeSourceId(sourceId: string): string {
  return `${ID_PREFIX}${sourceId}`;
}

function runtimeLayerId(layerId: string, styleLayerId: string): string {
  return `${ID_PREFIX}${layerId}:${styleLayerId}`;
}

function toRuntimeLayer(layerId: string, layer: LayerSpecification, style: MapLibreLayerStyle): LayerSpecification {
  const id = runtimeLayerId(layerId, layer.id);
  if (!('source' in layer) || !style.sources?.[layer.source]) {
    return { ...layer, id };
  }
  return { ...layer, id, source: runtimeSourceId(layer.source) };
}

export class MapLibreLayerManagerAdapter<TLayer = unknown, TGroup = undefined>
implements LayerManagerAdapter<TLayer, TGroup> {
  private readonly map: MapLibreMap;
  private readonly layerFactory: MapLibreLayerFactory<TLayer>;

  constructor(map: MapLibreMap, options: MapLibreAdapterOptions<TLayer>) {
    this.map = map;
    this.layerFactory = options.layerFactory;
  }

  onLayerAdded(info: ManagedLayerInfo<TLayer, TGroup>): void {
    if (info.layerType !== 'layer') {
      return;
    }
    const style = this.layerFactory(info, this.map);
    if (!style) {
      return;
    }
    for (const [sourceId, source] of Object.entries(style.sources ?? {})) {
      const id = runtimeSourceId(sourceId);
      if (!this.map.getSource(id)) {
        this.map.addSource(id, source);
      }
    }
    for (const layer of style.layers) {
      this.map.addLayer(toRuntimeLayer(info.layerId, layer, style));
    }
  }
}
