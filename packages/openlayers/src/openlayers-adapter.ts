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

  protected placeLayer({ rendered, visible, computedOpacity }: RenderedLayer<BaseLayer>): void {
    rendered.setVisible(visible);
    rendered.setOpacity(computedOpacity);
    this.map.addLayer(rendered);
  }

  protected eraseLayer(_layerId: string, rendered: BaseLayer): void {
    this.map.removeLayer(rendered);
  }

  protected setLayerVisible({ rendered, visible }: RenderedLayer<BaseLayer>): void {
    rendered.setVisible(visible);
  }

  protected setLayerOpacity({ rendered, computedOpacity }: RenderedLayer<BaseLayer>): void {
    rendered.setOpacity(computedOpacity);
  }

  protected restackLayers(_bottomToTop: RenderedLayer<BaseLayer>[]): void {}
}
