import type { LayerInfo } from '@ulm/core';

import type L from 'leaflet';
import type { LeafletRenderLayer } from './types';

/**
 * Convention: if layerData has a `leafletLayer` property, use it.
 * Otherwise return null (pass your own renderLayer to show other data).
 */
export function createDefaultLeafletRenderLayer<TLayer>(): LeafletRenderLayer<TLayer> {
  return (info: LayerInfo<TLayer>, _map: L.Map): L.Layer | null => {
    const data = info.layerData as Record<string, unknown> | null | undefined;
    if (data && 'leafletLayer' in data) {
      const layer = (data as { leafletLayer: L.Layer }).leafletLayer;
      if (layer) {
        return layer;
      }
    }
    return null;
  };
}
