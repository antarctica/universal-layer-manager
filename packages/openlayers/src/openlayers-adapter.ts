import type { RenderedLayer } from '@ulm/core';
import type Collection from 'ol/Collection.js';
import type BaseLayer from 'ol/layer/Base.js';
import type LayerGroup from 'ol/layer/Group.js';
import type OlMap from 'ol/Map.js';
import type { OpenLayersAdapterArgs } from './types';

import { RenderAdapter } from '@ulm/core';
import { defaultOpenLayersRenderLayer } from './default-render-layer';

export class OpenLayersLayerManagerAdapter<TLayer = unknown, TGroup = undefined>
  extends RenderAdapter<TLayer, TGroup, OlMap, BaseLayer> {
  private readonly container: LayerGroup | undefined;

  constructor(map: OlMap, ...[options = {}]: OpenLayersAdapterArgs<TLayer>) {
    super(map, { renderLayer: options.renderLayer ?? defaultOpenLayersRenderLayer, disposeLayer: options.disposeLayer });
    this.container = options.container;
  }

  protected placeLayer({ rendered, visible, computedOpacity }: RenderedLayer<BaseLayer>): void {
    rendered.setVisible(visible);
    rendered.setOpacity(computedOpacity);
    if (!this.layerCollection.getArray().includes(rendered)) {
      this.layerCollection.push(rendered);
    }
  }

  protected eraseLayer(_layerId: string, rendered: BaseLayer, next?: BaseLayer): void {
    const layers = this.layerCollection;
    if (next) {
      layers.insertAt(layers.getArray().indexOf(rendered), next);
    }
    layers.remove(rendered);
  }

  protected setLayerVisible({ rendered, visible }: RenderedLayer<BaseLayer>): void {
    rendered.setVisible(visible);
  }

  protected setLayerOpacity({ rendered, computedOpacity }: RenderedLayer<BaseLayer>): void {
    rendered.setOpacity(computedOpacity);
  }

  protected restackLayers(bottomToTop: RenderedLayer<BaseLayer>[]): void {
    const layers = this.layerCollection;
    const bottom = Math.min(...bottomToTop.map(({ rendered }) => layers.getArray().indexOf(rendered)));
    bottomToTop.forEach(({ rendered }, index) => {
      if (layers.item(bottom + index) !== rendered) {
        layers.remove(rendered);
        layers.insertAt(bottom + index, rendered);
      }
    });
  }

  private get layerCollection(): Collection<BaseLayer> {
    return this.container?.getLayers() ?? this.map.getLayers();
  }
}
