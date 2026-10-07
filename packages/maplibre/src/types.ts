import type { LayerInfo } from '@ulm/core';

import type { MapLibreMap, TransformStyleFunction } from 'maplibre-gl';
import type { createDefaultMapLibreFactory } from './default-factory';

// maplibre-gl does not export the style spec types, so they are read off its API.
export type StyleSpecification = ReturnType<TransformStyleFunction>;
export type LayerSpecification = StyleSpecification['layers'][number];
export type SourceSpecification = StyleSpecification['sources'][string];

// ============================================================================
// LAYER FACTORY
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
 * The adapter calls it when a layer is added and again when its `layerData` is replaced.
 *
 * Without one, the adapter uses {@link createDefaultMapLibreFactory}, which draws `layerData` that is already a
 * {@link MapLibreLayerStyle}. Write your own to keep other data in `layerData`, such as a URL, and fall back to the
 * default for the rest:
 *
 * ```ts
 * const drawStyle = createDefaultMapLibreFactory<LayerData>();
 *
 * const layerFactory: MapLibreLayerFactory<LayerData> = (info, map) => {
 *   if ('geojsonUrl' in info.layerData) {
 *     return {
 *       sources: { [info.layerId]: { type: 'geojson', data: info.layerData.geojsonUrl } },
 *       layers: [{ id: 'line', type: 'line', source: info.layerId }],
 *     };
 *   }
 *   return drawStyle(info, map);
 * };
 * ```
 */
export type MapLibreLayerFactory<TLayer> = (
  info: LayerInfo<TLayer>,
  map: MapLibreMap,
) => MapLibreLayerStyle | null;

// ============================================================================
// ADAPTER OPTIONS
// ============================================================================

export interface MapLibreAdapterOptions<TLayer> {
  /** Builds each layer's style. Defaults to {@link createDefaultMapLibreFactory}. */
  layerFactory?: MapLibreLayerFactory<TLayer>;
  /**
   * Undoes what was set up for a layer's style once the adapter discards it: when the layer is removed, when the
   * factory returns a different style, and when the adapter is detached. A style that differs only in GeoJSON data or
   * tile URLs is updated in place, not discarded, and hiding a layer does not discard its style.
   */
  disposeLayer?: (style: MapLibreLayerStyle, layerId: string) => void;
  /**
   * The ID of a style layer to draw every layer below. Leave it out to draw them below the
   * map's first label layer, or on top when the map has no labels.
   */
  drawBelow?: string;
}
