import type { MapLibreLayerFactory, MapLibreLayerStyle } from './types';

function isMapLibreLayerStyle(data: unknown): data is MapLibreLayerStyle {
  return typeof data === 'object' && data !== null && 'layers' in data && Array.isArray(data.layers);
}

/**
 * The factory the adapter uses when it is given none: a layer whose `layerData` is a {@link MapLibreLayerStyle}
 * is drawn with that style, and any other layer is left off the map.
 */
export function createDefaultMapLibreFactory<TLayer>(): MapLibreLayerFactory<TLayer> {
  return (info) => (isMapLibreLayerStyle(info.layerData) ? info.layerData : null);
}
