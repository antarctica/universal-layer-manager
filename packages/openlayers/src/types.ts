import type { RenderAdapterArgs, RenderAdapterOptions, RenderLayer } from '@ulm/core';
import type BaseLayer from 'ol/layer/Base.js';
import type OlMap from 'ol/Map.js';

// ============================================================================
// RENDER LAYER
// Returns the OpenLayers layer that shows a layer. Return null to skip.
// When a layer's data or time changes, `current` is the OpenLayers layer already
// on the map: return it to keep it, or return a new one to replace it.
// ============================================================================

export type OpenLayersRenderLayer<TLayer> = RenderLayer<TLayer, OlMap, BaseLayer>;

// ============================================================================
// ADAPTER OPTIONS
// ============================================================================

export type OpenLayersAdapterOptions<TLayer> = RenderAdapterOptions<TLayer, OlMap, BaseLayer>;

/** The layer data the default renderLayer shows: the OpenLayers layer itself. */
export interface OpenLayersLayerData {
  openlayersLayer: BaseLayer;
}

/** The adapter's options: optional when every layer's data is {@link OpenLayersLayerData}, otherwise with `renderLayer`. */
export type OpenLayersAdapterArgs<TLayer> = RenderAdapterArgs<TLayer, OpenLayersAdapterOptions<TLayer>, OpenLayersLayerData>;
