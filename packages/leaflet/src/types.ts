import type { LayerInfo } from '@ulm/core';

import type L from 'leaflet';

// ============================================================================
// LAYER FACTORY
// Creates a Leaflet layer from adapter layer info. Return null to skip.
// When a layer's data changes, `current` is the Leaflet layer already drawn:
// return it to keep it, or return a new one to replace it.
// ============================================================================

export type LeafletLayerFactory<TLayer> = (
  info: LayerInfo<TLayer>,
  map: L.Map,
  current?: L.Layer,
) => L.Layer | null;

// ============================================================================
// ADAPTER OPTIONS
// ============================================================================

export interface LeafletAdapterOptions<TLayer> {
  layerFactory?: LeafletLayerFactory<TLayer>;
  /**
   * Undoes what was set up for a Leaflet layer once the adapter discards it: when its layer is removed, when the
   * factory returns a different Leaflet layer, and when the adapter is detached. Hiding a layer does not discard it.
   */
  disposeLayer?: (leafletLayer: L.Layer, layerId: string) => void;
}
