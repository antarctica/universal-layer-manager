import type { LayerInfo } from '@ulm/core';
import type BaseLayer from 'ol/layer/Base.js';
import type { OpenLayersLayerData } from './types';

function isOpenLayersLayerData(data: unknown): data is OpenLayersLayerData {
  return typeof data === 'object' && data !== null && 'openlayersLayer' in data && Boolean(data.openlayersLayer);
}

/**
 * The renderLayer the adapter uses when it is given none: it shows `layerData.openlayersLayer`, and leaves any other
 * layer off the map. Call it from your own renderLayer for the layers you don't handle.
 */
export function defaultOpenLayersRenderLayer<TLayer>(info: LayerInfo<TLayer>): BaseLayer | null {
  return isOpenLayersLayerData(info.layerData) ? info.layerData.openlayersLayer : null;
}
