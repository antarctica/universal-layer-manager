import type { LayerManagerAdapter, ManagedLayerInfo } from '@ulm/core';

import type { MapLibreMap, Style } from 'maplibre-gl';
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
  private readonly layerStyles = new Map<string, MapLibreLayerStyle>();
  // isStyleLoaded() goes false while tiles load, so this tracks the style that last finished loading.
  private loadedStyle: Style | undefined;

  constructor(map: MapLibreMap, options: MapLibreAdapterOptions<TLayer>) {
    this.map = map;
    this.layerFactory = options.layerFactory;
  }

  // --------------------------------------------------------------------------
  // Lifecycle — called by LayerManager
  // --------------------------------------------------------------------------

  register(): void {
    // getStyle() returns nothing until the style has loaded.
    if (this.map.getStyle()) {
      this.loadedStyle = this.map.style;
    }
    this.map.on('style.load', this.handleStyleLoad);
  }

  // --------------------------------------------------------------------------
  // Layer lifecycle — called directly by LayerManager (push model)
  // --------------------------------------------------------------------------

  onLayerAdded(info: ManagedLayerInfo<TLayer, TGroup>): void {
    if (info.layerType !== 'layer') {
      return;
    }
    const style = this.layerFactory(info, this.map);
    if (!style) {
      return;
    }
    this.layerStyles.set(info.layerId, style);
    if (this.isStyleReady()) {
      this.writeLayer(info.layerId, style);
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private readonly handleStyleLoad = (): void => {
    this.loadedStyle = this.map.style;
    for (const [layerId, style] of this.layerStyles) {
      this.writeLayer(layerId, style);
    }
  };

  private isStyleReady(): boolean {
    return this.loadedStyle !== undefined && this.loadedStyle === this.map.style;
  }

  // Adds the layer's sources and style layers that the map is missing.
  private writeLayer(layerId: string, style: MapLibreLayerStyle): void {
    for (const [sourceId, source] of Object.entries(style.sources ?? {})) {
      const id = runtimeSourceId(sourceId);
      if (!this.map.getSource(id)) {
        this.map.addSource(id, source);
      }
    }
    for (const layer of style.layers) {
      const runtimeLayer = toRuntimeLayer(layerId, layer, style);
      if (!this.map.getLayer(runtimeLayer.id)) {
        this.map.addLayer(runtimeLayer);
      }
    }
  }
}
