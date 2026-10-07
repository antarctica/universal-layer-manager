import type { LayerInfo, LayerManagerAdapter, ManagedLayerInfo } from '@ulm/core';

import type { GeoJSONSource, MapLibreMap, RasterTileSource, Style, VectorTileSource } from 'maplibre-gl';
import type { LayerSpecification, MapLibreAdapterArgs, MapLibreLayerStyle, SourceSpecification } from './types';

import { RenderedLayers } from '@ulm/core';
import { ErrorEvent } from 'maplibre-gl';
import { defaultMapLibreRenderLayer } from './default-render-layer';

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

// A source's spec without the values MapLibre updates in place: GeoJSON data, and a tile source's tiles and url.
function withoutInPlaceValues(sources: MapLibreLayerStyle['sources'] = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(sources).map(([id, source]) => {
    if (source.type === 'geojson') {
      return [id, { ...source, data: null }];
    }
    return [id, isTileSource(source) ? { ...source, tiles: null, url: null } : source];
  }));
}

// Whether two styles draw the same, apart from the GeoJSON data and tile URLs that MapLibre updates in place.
function drawsTheSame(previous: MapLibreLayerStyle, next: MapLibreLayerStyle): boolean {
  return sameJson(previous.layers, next.layers) && sameJson(withoutInPlaceValues(previous.sources), withoutInPlaceValues(next.sources));
}

// A layer's visibility and computed opacity, kept so its style can be written once the style loads.
interface VisibilityAndOpacity {
  visible: boolean;
  computedOpacity: number;
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

function withVisibility(layer: LayerSpecification, visible: boolean): LayerSpecification {
  return { ...layer, layout: { ...layer.layout, visibility: visibilityOf(visible) } };
}

export class MapLibreLayerManagerAdapter<TLayer = unknown, TGroup = undefined>
implements LayerManagerAdapter<TLayer, TGroup> {
  private readonly map: MapLibreMap;
  private readonly drawBelow: string | undefined;
  private readonly styles: RenderedLayers<TLayer, MapLibreMap, MapLibreLayerStyle>;
  private readonly visibilityAndOpacity = new Map<string, VisibilityAndOpacity>();
  // The sources and style layers this adapter added to the current style. It removes and moves only these.
  private readonly ownedSourceIds = new Set<string>();
  private readonly ownedLayerIds = new Set<string>();
  private layerOrder: string[] = [];
  // isStyleLoaded() goes false while tiles load, so this tracks the style that last finished loading.
  private loadedStyle: Style | undefined;

  constructor(map: MapLibreMap, ...[options = {}]: MapLibreAdapterArgs<TLayer>) {
    this.map = map;
    this.drawBelow = options.drawBelow;
    this.styles = new RenderedLayers({
      map,
      renderLayer: options.renderLayer ?? defaultMapLibreRenderLayer,
      disposeLayer: options.disposeLayer,
      place: (info, style, previous) => this.placeStyle(info, style, previous),
      erase: (_layerId, style, next) => this.eraseStyle(style, next),
      isSame: drawsTheSame,
    });
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
    this.styles.clear();
    this.visibilityAndOpacity.clear();
  }

  // --------------------------------------------------------------------------
  // Layer lifecycle — called directly by LayerManager (push model)
  // --------------------------------------------------------------------------

  onLayerAdded(info: ManagedLayerInfo<TLayer, TGroup>): void {
    if (info.layerType !== 'layer') {
      return;
    }
    this.visibilityAndOpacity.set(info.layerId, { visible: info.visible, computedOpacity: info.computedOpacity });
    this.styles.add(info);
  }

  onLayerRemoved(layerId: string): void {
    this.styles.remove(layerId);
    this.visibilityAndOpacity.delete(layerId);
  }

  onVisibilityChanged(info: ManagedLayerInfo<TLayer, TGroup>, visible: boolean): void {
    const visibilityAndOpacity = this.visibilityAndOpacity.get(info.layerId);
    if (!visibilityAndOpacity) {
      return;
    }
    visibilityAndOpacity.visible = visible;
    const style = this.styles.get(info.layerId);
    if (style && this.isStyleReady()) {
      for (const layer of this.ownedStyleLayers(style)) {
        this.map.setLayoutProperty(layer.id, 'visibility', visibilityOf(visible));
      }
    }
  }

  onOpacityChanged(info: ManagedLayerInfo<TLayer, TGroup>, computedOpacity: number): void {
    const visibilityAndOpacity = this.visibilityAndOpacity.get(info.layerId);
    if (!visibilityAndOpacity) {
      return;
    }
    visibilityAndOpacity.computedOpacity = computedOpacity;
    const style = this.styles.get(info.layerId);
    if (!style || !this.isStyleReady()) {
      return;
    }
    for (const layer of this.ownedStyleLayers(style)) {
      for (const [property, value] of opacityWrites(layer, computedOpacity)) {
        this.map.setPaintProperty(layer.id, property, value);
      }
    }
  }

  onLayerDataChanged(info: ManagedLayerInfo<TLayer, TGroup>): void {
    this.styles.update(info);
  }

  // renderLayer can read the time, so a new time draws the layer again as new data does.
  onTimeInfoChanged(info: ManagedLayerInfo<TLayer, TGroup>): void {
    this.styles.update(info);
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

  // Adds a layer's style to the map. A style that differs from the one it replaces only in GeoJSON data or tile URLs
  // updates the sources in place, so the old features and tiles show until the new ones load.
  private placeStyle(info: LayerInfo<TLayer>, style: MapLibreLayerStyle, previous?: MapLibreLayerStyle): void {
    if (!this.isStyleReady()) {
      return;
    }
    if (previous && onlyGeoJsonDataChanged(previous, style)) {
      this.setGeoJsonData(previous, style);
      return;
    }
    this.updateTileUrls(previous, style);
    this.writeLayer(info.layerId, style, { visible: info.visible, computedOpacity: info.computedOpacity });
    // A layer being added is not in the order yet, and onOrderChanged stacks it.
    if (this.layerOrder.includes(info.layerId)) {
      this.restack();
    }
  }

  // Removes a layer's style from the map, keeping what `next` updates in place.
  private eraseStyle(style: MapLibreLayerStyle, next?: MapLibreLayerStyle): void {
    if (!this.isStyleReady() || (next && onlyGeoJsonDataChanged(style, next))) {
      return;
    }
    this.eraseLayer(style, next);
  }

  private readonly handleStyleLoad = (): void => {
    this.loadedStyle = this.map.style;
    // A new style starts without this adapter's sources and style layers, even where it uses the same IDs.
    this.ownedSourceIds.clear();
    this.ownedLayerIds.clear();
    for (const [layerId, visibilityAndOpacity] of this.visibilityAndOpacity) {
      const style = this.styles.get(layerId);
      if (style) {
        this.writeLayer(layerId, style, visibilityAndOpacity);
      }
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
      const style = this.styles.get(layerId);
      for (const layer of (style ? this.ownedStyleLayers(style) : []).reverse()) {
        // MapLibre puts the layer directly below `layerAbove`, or on top when it is undefined.
        this.map.moveLayer(layer.id, layerAbove);
        layerAbove = layer.id;
      }
    }
  }

  // The drawBelow option, else the map's first label layer, else undefined for the top.
  private layerToDrawBelow(): string | undefined {
    if (this.drawBelow && this.map.getLayer(this.drawBelow)) {
      return this.drawBelow;
    }
    return this.map.getLayersOrder().find((id) => !this.ownedLayerIds.has(id) && this.isLabelLayer(id));
  }

  // The layer's style layers that this adapter added, leaving out any it refused because their ID was taken.
  private ownedStyleLayers(style: MapLibreLayerStyle): LayerSpecification[] {
    return style.layers.filter(({ id }) => this.ownedLayerIds.has(id));
  }

  // A symbol layer with text, as in MapLibre's examples. Icon-only symbols, such as one-way arrows, are not labels.
  private isLabelLayer(id: string): boolean {
    return this.map.getLayer(id)?.type === 'symbol' && this.map.getLayoutProperty(id, 'text-field') !== undefined;
  }

  private setGeoJsonData(previous: MapLibreLayerStyle, next: MapLibreLayerStyle): void {
    for (const [sourceId, source] of Object.entries(next.sources ?? {})) {
      const before = previous.sources?.[sourceId];
      if (source.type === 'geojson' && before?.type === 'geojson' && source.data !== before.data) {
        void this.map.getSource<GeoJSONSource>(sourceId)?.setData(source.data);
      }
    }
  }

  private updateTileUrls(previous: MapLibreLayerStyle | undefined, next: MapLibreLayerStyle): void {
    for (const [sourceId, source] of Object.entries(next.sources ?? {})) {
      const before = previous?.sources?.[sourceId];
      const tileSource = this.map.getSource<RasterTileSource | VectorTileSource>(sourceId);
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
  private eraseLayer(style: MapLibreLayerStyle, next?: MapLibreLayerStyle): void {
    for (const layer of this.ownedStyleLayers(style)) {
      this.map.removeLayer(layer.id);
      this.ownedLayerIds.delete(layer.id);
    }
    for (const [sourceId, source] of Object.entries(style.sources ?? {})) {
      if (this.ownedSourceIds.has(sourceId) && !this.isSourceShared(sourceId) && !canUpdateInPlace(source, next?.sources?.[sourceId])) {
        this.removeSource(sourceId);
      }
    }
  }

  private isSourceShared(sourceId: string): boolean {
    return [...this.visibilityAndOpacity.keys()].some((layerId) => this.styles.get(layerId)?.sources?.[sourceId]);
  }

  // Removes a source this adapter added. A style layer the app added that still reads it keeps it on the map.
  private removeSource(id: string): void {
    if (this.map.getLayersOrder().some((layerId) => this.map.getLayer(layerId)?.source === id)) {
      return;
    }
    this.map.removeSource(id);
    this.ownedSourceIds.delete(id);
  }

  // Adds the layer's sources and style layers that the map is missing.
  private writeLayer(layerId: string, style: MapLibreLayerStyle, visibilityAndOpacity: VisibilityAndOpacity): void {
    const taken = this.takenId(style);
    if (taken) {
      this.map.fire(new ErrorEvent(new Error(`Layer "${layerId}" is not drawn: the map already has a ${taken}.`)));
      return;
    }
    for (const [sourceId, source] of Object.entries(style.sources ?? {})) {
      if (!this.map.getSource(sourceId)) {
        this.map.addSource(sourceId, source);
        this.ownedSourceIds.add(sourceId);
      }
    }
    for (const layer of style.layers) {
      if (!this.map.getLayer(layer.id)) {
        this.map.addLayer(withVisibility(layer, visibilityAndOpacity.visible));
        this.ownedLayerIds.add(layer.id);
        for (const [property, value] of opacityWrites(layer, visibilityAndOpacity.computedOpacity)) {
          this.map.setPaintProperty(layer.id, property, value);
        }
      }
    }
  }

  // The first of the style's IDs that the map already has from someone else, such as the basemap.
  private takenId(style: MapLibreLayerStyle): string | undefined {
    const source = Object.keys(style.sources ?? {}).find((id) => this.map.getSource(id) && !this.ownedSourceIds.has(id));
    if (source) {
      return `source "${source}"`;
    }
    const layer = style.layers.find(({ id }) => this.map.getLayer(id) && !this.ownedLayerIds.has(id));
    return layer && `style layer "${layer.id}"`;
  }
}
