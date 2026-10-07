import type { LayerInfo } from '@ulm/core';

import type L from 'leaflet';
import type { LeafletLayerData } from './types';

function isLeafletLayerData(data: unknown): data is LeafletLayerData {
  return typeof data === 'object' && data !== null && 'leafletLayer' in data && Boolean(data.leafletLayer);
}

/**
 * The renderLayer the adapter uses when it is given none: it shows `layerData.leafletLayer`, and leaves any other
 * layer off the map. Call it from your own renderLayer for the layers you don't handle.
 */
export function defaultLeafletRenderLayer<TLayer>(info: LayerInfo<TLayer>): L.Layer | null {
  return isLeafletLayerData(info.layerData) ? info.layerData.leafletLayer : null;
}
