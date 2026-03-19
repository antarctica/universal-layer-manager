import type { LayerInfo } from '@ulm/core';

import type L from 'leaflet';

// ============================================================================
// LAYER FACTORY
// Creates a Leaflet layer from adapter layer info. Return null to skip.
// ============================================================================

export type LeafletLayerFactory<TLayer> = (
  info: LayerInfo<TLayer>,
  map: L.Map,
) => L.Layer | null;

// ============================================================================
// HOOKS
// Optional callbacks for custom behaviour. Additive only.
// ============================================================================

export interface LeafletAdapterHooks<TLayer> {
  onLayerAdded?: (info: LayerInfo<TLayer>, leafletLayer: L.Layer) => void;
  onLayerRemoved?: (layerId: string, leafletLayer: L.Layer) => void;
  onVisibilityChanged?: (
    info: LayerInfo<TLayer>,
    visible: boolean,
    leafletLayer: L.Layer,
  ) => void;
  onOpacityChanged?: (
    info: LayerInfo<TLayer>,
    opacity: number,
    computedOpacity: number,
    leafletLayer: L.Layer,
  ) => void;
  onLayerDataChanged?: (
    info: LayerInfo<TLayer>,
    leafletLayer: L.Layer,
  ) => void;
}

// ============================================================================
// ADAPTER OPTIONS
// ============================================================================

export interface LeafletAdapterOptions<TLayer> {
  layerFactory?: LeafletLayerFactory<TLayer>;
  hooks?: LeafletAdapterHooks<TLayer>;
}
