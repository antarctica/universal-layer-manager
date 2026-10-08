import type { RenderedLayer } from '@ulm/core';
import type BaseLayer from 'ol/layer/Base.js';
import type OlMap from 'ol/Map.js';
import type { OpenLayersAdapterArgs } from './types';

import { RenderAdapter } from '@ulm/core';
import LayerGroup from 'ol/layer/Group.js';
import { defaultOpenLayersRenderLayer } from './default-render-layer';

export class OpenLayersLayerManagerAdapter<TLayer = unknown, TGroup = undefined>
  extends RenderAdapter<TLayer, TGroup, OlMap, BaseLayer> {
  private readonly container: LayerGroup;
  private readonly ownsContainer: boolean;

  constructor(map: OlMap, ...[options = {}]: OpenLayersAdapterArgs<TLayer>) {
    super(map, { renderLayer: options.renderLayer ?? defaultOpenLayersRenderLayer, disposeLayer: options.disposeLayer });
    this.container = options.container ?? new LayerGroup();
    this.ownsContainer = !options.container;
  }

  register(): void {
    if (this.ownsContainer) {
      this.map.addLayer(this.container);
    }
  }

  override unregister(): void {
    super.unregister();
    if (this.ownsContainer) {
      this.map.removeLayer(this.container);
    }
  }

  protected placeLayer({ rendered, visible, computedOpacity }: RenderedLayer<BaseLayer>): void {
    rendered.setVisible(visible);
    rendered.setOpacity(computedOpacity);
    this.container.getLayers().push(rendered);
  }

  protected eraseLayer(_layerId: string, rendered: BaseLayer): void {
    this.container.getLayers().remove(rendered);
  }

  protected setLayerVisible({ rendered, visible }: RenderedLayer<BaseLayer>): void {
    rendered.setVisible(visible);
  }

  protected setLayerOpacity({ rendered, computedOpacity }: RenderedLayer<BaseLayer>): void {
    rendered.setOpacity(computedOpacity);
  }

  protected restackLayers(bottomToTop: RenderedLayer<BaseLayer>[]): void {
    const layers = this.container.getLayers();
    bottomToTop.forEach(({ rendered }, index) => {
      if (layers.item(index) !== rendered) {
        layers.remove(rendered);
        layers.insertAt(index, rendered);
      }
    });
  }
}
