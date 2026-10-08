import type { RenderAdapterArgs, RenderAdapterOptions, RenderLayer } from '@ulm/core';
import type BaseLayer from 'ol/layer/Base.js';
import type LayerGroup from 'ol/layer/Group.js';
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

export interface OpenLayersAdapterOptions<TLayer> extends RenderAdapterOptions<TLayer, OlMap, BaseLayer> {
  /**
   * The layer group to draw every layer in, already on the map where the app wants them. Leave it out to draw them in
   * a group the adapter adds on top of the map.
   */
  container?: LayerGroup;
}

/** The layer data the default renderLayer shows: the OpenLayers layer itself. */
export interface OpenLayersLayerData {
  openlayersLayer: BaseLayer;
}

/** The adapter's options: optional when every layer's data is {@link OpenLayersLayerData}, otherwise with `renderLayer`. */
export type OpenLayersAdapterArgs<TLayer> = RenderAdapterArgs<TLayer, OpenLayersAdapterOptions<TLayer>, OpenLayersLayerData>;
