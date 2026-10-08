import type { RenderedLayer } from '@ulm/core';
import type BaseLayer from 'ol/layer/Base.js';
import type OlMap from 'ol/Map.js';
import type { OpenLayersAdapterArgs } from './types';

import { RenderAdapter } from '@ulm/core';
import { defaultOpenLayersRenderLayer } from './default-render-layer';

export class OpenLayersLayerManagerAdapter<TLayer = unknown, TGroup = undefined>
  extends RenderAdapter<TLayer, TGroup, OlMap, BaseLayer> {
  constructor(map: OlMap, ...[options = {}]: OpenLayersAdapterArgs<TLayer>) {
    super(map, { renderLayer: options.renderLayer ?? defaultOpenLayersRenderLayer, disposeLayer: options.disposeLayer });
  }

  protected placeLayer({ rendered }: RenderedLayer<BaseLayer>): void {
    this.map.addLayer(rendered);
  }

  protected eraseLayer(_layerId: string, _rendered: BaseLayer): void {}

  protected setLayerVisible(_layer: RenderedLayer<BaseLayer>): void {}

  protected setLayerOpacity(_layer: RenderedLayer<BaseLayer>): void {}

  protected restackLayers(_bottomToTop: RenderedLayer<BaseLayer>[]): void {}
}
