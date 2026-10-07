import type { LayerManagerAdapter, ManagedLayerInfo } from '@ulm/core';

import type { GeoJSONSource, MapLibreMap, RasterTileSource, Style, VectorTileSource } from 'maplibre-gl';
import type { LayerSpecification, MapLibreAdapterOptions, MapLibreLayerFactory, MapLibreLayerStyle, SourceSpecification } from './types';

import { createDefaultMapLibreFactory } from './default-factory';

// The prefix keeps runtime IDs clear of the basemap's.
const ID_PREFIX = 'ulm:';

function runtimeSourceId(sourceId: string): string {
  return `${ID_PREFIX}${sourceId}`;
}

function runtimeLayerId(layerId: string, styleLayerId: string): string {
  return `${ID_PREFIX}${layerId}:${styleLayerId}`;
}

// Style specs are plain JSON.
function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

type TileSourceSpecification = Extract<SourceSpecification, { type: 'vector' | 'raster' | 'raster-dem' }>;

function isTileSource(source: SourceSpecification): source is TileSourceSpecification {
  return source.type === 'vector' || source.type === 'raster' || source.type === 'raster-dem';
}

// Whether MapLibre can change a source from `before` to `next` in place. setTiles and setUrl keep the old tiles showing until the new ones load.
function canUpdateInPlace(before: SourceSpecification, next: SourceSpecification | undefined): boolean {
  if (next && isTileSource(before) && isTileSource(next)) {
    return sameJson({ ...before, tiles: null, url: null }, { ...next, tiles: null, url: null });
  }
  return sameJson(before, next);
}

function withoutGeoJsonData(sources: MapLibreLayerStyle['sources'] = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(sources).map(([id, source]) => [id, source.type === 'geojson' ? { ...source, data: null } : source]));
}

// When only GeoJSON data changed, setData can update the map without redrawing the layer.
function onlyGeoJsonDataChanged(previous: MapLibreLayerStyle, next: MapLibreLayerStyle): boolean {
  return sameJson(previous.layers, next.layers) && sameJson(withoutGeoJsonData(previous.sources), withoutGeoJsonData(next.sources));
}

interface DrawnLayer {
  style: MapLibreLayerStyle;
  visible: boolean;
  opacity: number;
}

function visibilityOf(visible: boolean): 'visible' | 'none' {
  return visible ? 'visible' : 'none';
}

type PaintProperty = Parameters<MapLibreMap['setPaintProperty']>[1];
type PaintValue = Parameters<MapLibreMap['setPaintProperty']>[2];
type PaintWrite = [property: PaintProperty, value: PaintValue | undefined];

// For style layers MapLibre cannot fade as a whole, the opacity properties the adapter scales.
const OWN_OPACITY_PROPERTIES: Partial<Record<LayerSpecification['type'], PaintProperty[]>> = {
  'raster': ['raster-opacity'],
  'circle': ['circle-opacity', 'circle-stroke-opacity'],
  'heatmap': ['heatmap-opacity'],
  'fill-extrusion': ['fill-extrusion-opacity'],
  'background': ['background-opacity'],
  'color-relief': ['color-relief-opacity'],
  'symbol': ['icon-opacity', 'text-opacity'],
};

function paintValue(layer: LayerSpecification, property: PaintProperty): PaintValue | undefined {
  const paint: Partial<Record<PaintProperty, PaintValue>> | undefined = layer.paint;
  return paint?.[property];
}

function scaleExpression(value: unknown, opacity: number): unknown {
  if (typeof value === 'number') {
    return value * opacity;
  }
  // A zoom curve must stay the outermost expression, so its outputs are scaled in place.
  if (Array.isArray(value) && value[0] === 'interpolate') {
    return value.map((part, index) => (index >= 4 && index % 2 === 0 ? scaleExpression(part, opacity) : part));
  }
  if (Array.isArray(value) && value[0] === 'step') {
    return value.map((part, index) => (index >= 2 && index % 2 === 0 ? scaleExpression(part, opacity) : part));
  }
  return ['*', opacity, value];
}

function scaleOpacity(value: PaintValue, opacity: number): PaintValue {
  // Expressions are plain JSON, so the scaled copy is typed back here.
  return scaleExpression(value, opacity) as PaintValue;
}

// The paint values that fade a style layer to `opacity`.
function opacityWrites(layer: LayerSpecification, opacity: number): PaintWrite[] {
  switch (layer.type) {
    case 'fill':
      return [['fill-layer-opacity', opacity]];
    case 'line':
      return [['line-layer-opacity', opacity]];
    default:
      return (OWN_OPACITY_PROPERTIES[layer.type] ?? []).map((property) => {
        const value = paintValue(layer, property);
        return [property, opacity === 1 ? value : scaleOpacity(value ?? 1, opacity)];
      });
  }
}

function toRuntimeLayer(layerId: string, layer: LayerSpecification, drawn: DrawnLayer): LayerSpecification {
  const id = runtimeLayerId(layerId, layer.id);
  const layout = { ...layer.layout, visibility: visibilityOf(drawn.visible) };
  if (!('source' in layer) || !drawn.style.sources?.[layer.source]) {
    return { ...layer, id, layout };
  }
  return { ...layer, id, layout, source: runtimeSourceId(layer.source) };
}

export class MapLibreLayerManagerAdapter<TLayer = unknown, TGroup = undefined>
implements LayerManagerAdapter<TLayer, TGroup> {
  private readonly map: MapLibreMap;
  private readonly layerFactory: MapLibreLayerFactory<TLayer>;
  private readonly drawBelow: string | undefined;
  private readonly drawnLayers = new Map<string, DrawnLayer>();
  private layerOrder: string[] = [];
  // isStyleLoaded() goes false while tiles load, so this tracks the style that last finished loading.
  private loadedStyle: Style | undefined;

  constructor(map: MapLibreMap, options: MapLibreAdapterOptions<TLayer> = {}) {
    this.map = map;
    this.layerFactory = options.layerFactory ?? createDefaultMapLibreFactory<TLayer>();
    this.drawBelow = options.drawBelow;
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

  unregister(): void {
    this.map.off('style.load', this.handleStyleLoad);
    const drawnLayers = [...this.drawnLayers];
    this.drawnLayers.clear();
    if (this.isStyleReady()) {
      for (const [layerId, drawn] of drawnLayers) {
        this.eraseLayer(layerId, drawn);
      }
    }
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

  onLayerRemoved(layerId: string): void {
    const drawn = this.drawnLayers.get(layerId);
    if (!drawn) {
      return;
    }
    this.drawnLayers.delete(layerId);
    if (this.isStyleReady()) {
      this.eraseLayer(layerId, drawn);
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
      for (const [property, value] of opacityWrites(layer, computedOpacity)) {
        this.map.setPaintProperty(runtimeLayerId(info.layerId, layer.id), property, value);
      }
    }
  }

  onLayerDataChanged(info: ManagedLayerInfo<TLayer, TGroup>): void {
    if (info.layerType !== 'layer') {
      return;
    }
    const previous = this.drawnLayers.get(info.layerId);
    const style = this.layerFactory(info, this.map);
    if (previous && style && onlyGeoJsonDataChanged(previous.style, style)) {
      this.drawnLayers.set(info.layerId, { ...previous, style });
      if (this.isStyleReady()) {
        this.setGeoJsonData(previous.style, style);
      }
      return;
    }
    // Any other change redraws the layer: its old style layers and sources go, the new ones come.
    this.drawnLayers.delete(info.layerId);
    if (previous && this.isStyleReady()) {
      this.eraseLayer(info.layerId, previous, style ?? undefined);
    }
    if (style) {
      const drawn = { style, visible: info.visible, opacity: info.computedOpacity };
      this.drawnLayers.set(info.layerId, drawn);
      if (this.isStyleReady()) {
        this.updateTileUrls(previous?.style, style);
        this.writeLayer(info.layerId, drawn);
        this.restack();
      }
    }
  }

  onOrderChanged(layerOrder: string[]): void {
    this.layerOrder = layerOrder;
    if (this.isStyleReady()) {
      this.restack();
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
    this.restack();
  };

  private isStyleReady(): boolean {
    return this.loadedStyle !== undefined && this.loadedStyle === this.map.style;
  }

  // Works from the top down, putting each style layer directly below the one placed before it.
  private restack(): void {
    let layerAbove = this.layerToDrawBelow();
    for (const layerId of [...this.layerOrder].reverse()) {
      const drawn = this.drawnLayers.get(layerId);
      for (const layer of [...(drawn?.style.layers ?? [])].reverse()) {
        const id = runtimeLayerId(layerId, layer.id);
        if (this.map.getLayer(id)) {
          // MapLibre puts `id` directly below `layerAbove`, or on top when it is undefined.
          this.map.moveLayer(id, layerAbove);
          layerAbove = id;
        }
      }
    }
  }

  // The drawBelow option, else the map's first label layer, else undefined for the top.
  private layerToDrawBelow(): string | undefined {
    if (this.drawBelow && this.map.getLayer(this.drawBelow)) {
      return this.drawBelow;
    }
    return this.map.getLayersOrder().find((id) => !id.startsWith(ID_PREFIX) && this.isLabelLayer(id));
  }

  // A symbol layer with text, as in MapLibre's examples. Icon-only symbols, such as one-way arrows, are not labels.
  private isLabelLayer(id: string): boolean {
    return this.map.getLayer(id)?.type === 'symbol' && this.map.getLayoutProperty(id, 'text-field') !== undefined;
  }

  private setGeoJsonData(previous: MapLibreLayerStyle, next: MapLibreLayerStyle): void {
    for (const [sourceId, source] of Object.entries(next.sources ?? {})) {
      const before = previous.sources?.[sourceId];
      if (source.type === 'geojson' && before?.type === 'geojson' && source.data !== before.data) {
        void this.map.getSource<GeoJSONSource>(runtimeSourceId(sourceId))?.setData(source.data);
      }
    }
  }

  private updateTileUrls(previous: MapLibreLayerStyle | undefined, next: MapLibreLayerStyle): void {
    for (const [sourceId, source] of Object.entries(next.sources ?? {})) {
      const before = previous?.sources?.[sourceId];
      const tileSource = this.map.getSource<RasterTileSource | VectorTileSource>(runtimeSourceId(sourceId));
      if (!before || !isTileSource(source) || !isTileSource(before) || !tileSource) {
        continue;
      }
      if (source.tiles && !sameJson(source.tiles, before.tiles)) {
        tileSource.setTiles(source.tiles);
      }
      if (source.url && source.url !== before.url) {
        tileSource.setUrl(source.url);
      }
    }
  }

  // Removes the layer's style layers, then the sources no other layer reads and `next` does not keep as they are.
  private eraseLayer(layerId: string, drawn: DrawnLayer, next?: MapLibreLayerStyle): void {
    for (const layer of drawn.style.layers) {
      const id = runtimeLayerId(layerId, layer.id);
      if (this.map.getLayer(id)) {
        this.map.removeLayer(id);
      }
    }
    for (const [sourceId, source] of Object.entries(drawn.style.sources ?? {})) {
      if (!this.isSourceShared(sourceId) && !canUpdateInPlace(source, next?.sources?.[sourceId])) {
        this.removeSource(runtimeSourceId(sourceId));
      }
    }
  }

  private isSourceShared(sourceId: string): boolean {
    return [...this.drawnLayers.values()].some((drawn) => drawn.style.sources?.[sourceId]);
  }

  // MapLibre keeps a source while any style layer reads it, so those go first.
  private removeSource(id: string): void {
    for (const layerId of this.map.getLayersOrder()) {
      if (this.map.getLayer(layerId)?.source === id) {
        this.map.removeLayer(layerId);
      }
    }
    if (this.map.getSource(id)) {
      this.map.removeSource(id);
    }
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
        for (const [property, value] of opacityWrites(layer, drawn.opacity)) {
          this.map.setPaintProperty(runtimeLayer.id, property, value);
        }
      }
    }
  }
}
