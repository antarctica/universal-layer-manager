import type GroupLayer from '@arcgis/core/layers/GroupLayer.js';
import type Layer from '@arcgis/core/layers/Layer.js';
import type EsriMap from '@arcgis/core/Map.js';
import type { RenderAdapterArgs, RenderAdapterOptions, RenderLayer } from '@ulm/core';

// ============================================================================
// RENDER LAYER
// Returns the ArcGIS layer that shows a layer. Return null to skip.
// When a layer's data or time changes, `current` is the ArcGIS layer already
// on the map: return it to keep it, or return a new one to replace it.
// ============================================================================

export type ArcGISRenderLayer<TLayer> = RenderLayer<TLayer, EsriMap, Layer>;

// ============================================================================
// ADAPTER OPTIONS
// ============================================================================

export interface ArcGISAdapterOptions<TLayer> extends RenderAdapterOptions<TLayer, EsriMap, Layer> {
  /**
   * The group layer to draw every layer in, already on the map where the app wants them. Leave it out to draw them in
   * a group the adapter adds on top of the map.
   */
  container?: GroupLayer;
}

/** The layer data the default renderLayer shows: the ArcGIS layer itself. */
export interface ArcGISLayerData {
  arcgisLayer: Layer;
}

/** The adapter's options: optional when every layer's data is {@link ArcGISLayerData}, otherwise with `renderLayer`. */
export type ArcGISAdapterArgs<TLayer> = RenderAdapterArgs<TLayer, ArcGISAdapterOptions<TLayer>, ArcGISLayerData>;
