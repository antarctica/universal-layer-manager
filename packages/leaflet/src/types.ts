import type { LayerInfo, LayerTimeInfo } from '@ulm/core';

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
  onEnabledChanged?: (
    info: LayerInfo<TLayer>,
    enabled: boolean,
    leafletLayer: L.Layer,
  ) => void;
  onOpacityChanged?: (
    info: LayerInfo<TLayer>,
    opacity: number,
    computedOpacity: number,
    leafletLayer: L.Layer,
  ) => void;
  onTimeInfoChanged?: (
    info: LayerInfo<TLayer>,
    timeInfo: LayerTimeInfo,
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
  /**
   * Undoes what was set up for a Leaflet layer once the adapter discards it: when its layer is removed, when the
   * factory returns a different Leaflet layer, and when the adapter is detached. Hiding a layer does not discard it.
   */
  disposeLayer?: (leafletLayer: L.Layer, layerId: string) => void;
  hooks?: LeafletAdapterHooks<TLayer>;
}
