import type { LayerInfo } from '@ulm/core';

import type { MapLibreMap, TransformStyleFunction } from 'maplibre-gl';

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

export type MapLibreLayerFactory<TLayer> = (
  info: LayerInfo<TLayer>,
  map: MapLibreMap,
) => MapLibreLayerStyle | null;

// ============================================================================
// ADAPTER OPTIONS
// ============================================================================

export interface MapLibreAdapterOptions<TLayer> {
  layerFactory: MapLibreLayerFactory<TLayer>;
}
