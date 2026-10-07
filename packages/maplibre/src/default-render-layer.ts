import type { MapLibreLayerStyle, MapLibreRenderLayer } from './types';

function isMapLibreLayerStyle(data: unknown): data is MapLibreLayerStyle {
  return typeof data === 'object' && data !== null && 'layers' in data && Array.isArray(data.layers);
}

/**
 * The renderLayer the adapter uses when it is given none: a layer whose `layerData` is a {@link MapLibreLayerStyle}
 * is drawn with that style, and any other layer is left off the map.
 */
export function createDefaultMapLibreRenderLayer<TLayer>(): MapLibreRenderLayer<TLayer> {
  return (info) => (isMapLibreLayerStyle(info.layerData) ? info.layerData : null);
}
