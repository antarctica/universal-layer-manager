import type { RenderAdapterOptions, RenderLayer } from '@ulm/core';

import type { MapLibreMap, TransformStyleFunction } from 'maplibre-gl';
import type { createDefaultMapLibreRenderLayer } from './default-render-layer';

// maplibre-gl does not export the style spec types, so they are read off its API.
export type StyleSpecification = ReturnType<TransformStyleFunction>;
export type LayerSpecification = StyleSpecification['layers'][number];
export type SourceSpecification = StyleSpecification['sources'][string];

// ============================================================================
// RENDER LAYER
// Describes a layer as MapLibre sources and style layers. Return null to skip.
// Layers that name the same source share it.
// ============================================================================

export interface MapLibreLayerStyle {
  /** The sources the style layers read, by ID. */
  sources?: Record<string, SourceSpecification>;
  /** The style layers, from the bottom up. */
  layers: LayerSpecification[];
}

/**
 * Turns a layer into the MapLibre sources and style layers that draw it, or `null` to leave it off the map.
 * The adapter calls it when a layer is added, and again when its `layerData` or `timeInfo` changes, with the style it
 * returned last time as `current`. Return `current` to leave the map as it is.
 *
 * Without one, the adapter uses {@link createDefaultMapLibreRenderLayer}, which draws `layerData` that is already a
 * {@link MapLibreLayerStyle}. Write your own to keep other data in `layerData`, such as a URL, and fall back to the
 * default for the rest:
 *
 * ```ts
 * const renderStyle = createDefaultMapLibreRenderLayer<LayerData>();
 *
 * const renderLayer: MapLibreRenderLayer<LayerData> = (info, map) => {
 *   if ('geojsonUrl' in info.layerData) {
 *     return {
 *       sources: { [info.layerId]: { type: 'geojson', data: info.layerData.geojsonUrl } },
 *       layers: [{ id: 'line', type: 'line', source: info.layerId }],
 *     };
 *   }
 *   return renderStyle(info, map);
 * };
 * ```
 */
export type MapLibreRenderLayer<TLayer> = RenderLayer<TLayer, MapLibreMap, MapLibreLayerStyle>;

// ============================================================================
// ADAPTER OPTIONS
// ============================================================================

export interface MapLibreAdapterOptions<TLayer> extends RenderAdapterOptions<TLayer, MapLibreMap, MapLibreLayerStyle> {
  /** Returns the style that shows each layer. Defaults to {@link createDefaultMapLibreRenderLayer}. */
  renderLayer?: MapLibreRenderLayer<TLayer>;
  /**
   * Undoes what was set up for a layer's style once the adapter discards it: when the layer is removed, when
   * `renderLayer` returns a different style, and when the adapter is detached. A style that differs only in GeoJSON
   * data or tile URLs is updated in place, not discarded, and hiding a layer does not discard its style.
   */
  disposeLayer?: RenderAdapterOptions<TLayer, MapLibreMap, MapLibreLayerStyle>['disposeLayer'];
  /**
   * The ID of a style layer to draw every layer below. Leave it out to draw them below the
   * map's first label layer, or on top when the map has no labels.
   */
  drawBelow?: string;
}
