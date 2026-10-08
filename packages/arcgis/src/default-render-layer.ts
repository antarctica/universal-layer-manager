import type Layer from '@arcgis/core/layers/Layer.js';
import type { LayerInfo } from '@ulm/core';
import type { ArcGISLayerData } from './types';

function isArcGISLayerData(data: unknown): data is ArcGISLayerData {
  return typeof data === 'object' && data !== null && 'arcgisLayer' in data && Boolean(data.arcgisLayer);
}

/**
 * The renderLayer the adapter uses when it is given none: it shows `layerData.arcgisLayer`, and leaves any other
 * layer off the map. Call it from your own renderLayer for the layers you don't handle.
 */
export function defaultArcGISRenderLayer<TLayer>(info: LayerInfo<TLayer>): Layer | null {
  return isArcGISLayerData(info.layerData) ? info.layerData.arcgisLayer : null;
}
