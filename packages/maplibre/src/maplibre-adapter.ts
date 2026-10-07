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

interface DrawnLayer {
  style: MapLibreLayerStyle;
  visible: boolean;
  opacity: number;
}

function visibilityOf(visible: boolean): 'visible' | 'none' {
  return visible ? 'visible' : 'none';
}

// The paint property that fades a whole style layer, where MapLibre has one.
function layerOpacityProperty(layer: LayerSpecification): 'fill-layer-opacity' | 'line-layer-opacity' | undefined {
  switch (layer.type) {
    case 'fill':
      return 'fill-layer-opacity';
    case 'line':
      return 'line-layer-opacity';
    default:
      return undefined;
  }
}

function withOpacity(layer: LayerSpecification, opacity: number): LayerSpecification {
  switch (layer.type) {
    case 'fill':
      return { ...layer, paint: { ...layer.paint, 'fill-layer-opacity': opacity } };
    case 'line':
      return { ...layer, paint: { ...layer.paint, 'line-layer-opacity': opacity } };
    default:
      return layer;
  }
}

function toRuntimeLayer(layerId: string, layer: LayerSpecification, drawn: DrawnLayer): LayerSpecification {
  const faded = withOpacity(layer, drawn.opacity);
  const id = runtimeLayerId(layerId, layer.id);
  const layout = { ...faded.layout, visibility: visibilityOf(drawn.visible) };
  if (!('source' in faded) || !drawn.style.sources?.[faded.source]) {
    return { ...faded, id, layout };
  }
  return { ...faded, id, layout, source: runtimeSourceId(faded.source) };
}

export class MapLibreLayerManagerAdapter<TLayer = unknown, TGroup = undefined>
implements LayerManagerAdapter<TLayer, TGroup> {
  private readonly map: MapLibreMap;
  private readonly layerFactory: MapLibreLayerFactory<TLayer>;
  private readonly drawnLayers = new Map<string, DrawnLayer>();
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
    const drawn = { style, visible: info.visible, opacity: info.computedOpacity };
    this.drawnLayers.set(info.layerId, drawn);
    if (this.isStyleReady()) {
      this.writeLayer(info.layerId, drawn);
    }
  }

  onVisibilityChanged(info: ManagedLayerInfo<TLayer, TGroup>, visible: boolean): void {
    const drawn = this.drawnLayers.get(info.layerId);
    if (!drawn) {
      return;
    }
    drawn.visible = visible;
    if (this.isStyleReady()) {
      for (const layer of drawn.style.layers) {
        this.map.setLayoutProperty(runtimeLayerId(info.layerId, layer.id), 'visibility', visibilityOf(visible));
      }
    }
  }

  onOpacityChanged(info: ManagedLayerInfo<TLayer, TGroup>, computedOpacity: number): void {
    const drawn = this.drawnLayers.get(info.layerId);
    if (!drawn) {
      return;
    }
    drawn.opacity = computedOpacity;
    if (!this.isStyleReady()) {
      return;
    }
    for (const layer of drawn.style.layers) {
      const property = layerOpacityProperty(layer);
      if (property) {
        this.map.setPaintProperty(runtimeLayerId(info.layerId, layer.id), property, computedOpacity);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private readonly handleStyleLoad = (): void => {
    this.loadedStyle = this.map.style;
    for (const [layerId, drawn] of this.drawnLayers) {
      this.writeLayer(layerId, drawn);
    }
  };

  private isStyleReady(): boolean {
    return this.loadedStyle !== undefined && this.loadedStyle === this.map.style;
  }

  // Adds the layer's sources and style layers that the map is missing.
  private writeLayer(layerId: string, drawn: DrawnLayer): void {
    for (const [sourceId, source] of Object.entries(drawn.style.sources ?? {})) {
      const id = runtimeSourceId(sourceId);
      if (!this.map.getSource(id)) {
        this.map.addSource(id, source);
      }
    }
    for (const layer of drawn.style.layers) {
      const runtimeLayer = toRuntimeLayer(layerId, layer, drawn);
      if (!this.map.getLayer(runtimeLayer.id)) {
        this.map.addLayer(runtimeLayer);
      }
    }
  }
}
