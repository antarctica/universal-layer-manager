import type { LayerInfo } from '@ulm/core';

import type { MapLibreLayerStyle } from './types';

function isMapLibreLayerStyle(data: unknown): data is MapLibreLayerStyle {
  return typeof data === 'object' && data !== null && 'layers' in data && Array.isArray(data.layers);
}

/**
 * The renderLayer the adapter uses when it is given none: a layer whose `layerData` is a {@link MapLibreLayerStyle}
 * is shown with that style, and any other layer is left off the map. Call it from your own renderLayer for the layers
 * you don't handle.
 */
export function defaultMapLibreRenderLayer<TLayer>(info: LayerInfo<TLayer>): MapLibreLayerStyle | null {
  return isMapLibreLayerStyle(info.layerData) ? info.layerData : null;
}
