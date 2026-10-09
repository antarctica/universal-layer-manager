import type Collection from '@arcgis/core/core/Collection.js';
import type GroupLayer from '@arcgis/core/layers/GroupLayer.js';
import type Layer from '@arcgis/core/layers/Layer.js';
import type EsriMap from '@arcgis/core/Map.js';
import type { RenderedLayer } from '@ulm/core';
import type { ArcGISAdapterArgs } from './types';

import { RenderAdapter } from '@ulm/core';
import { defaultArcGISRenderLayer } from './default-render-layer';

export class ArcGISLayerManagerAdapter<TLayer = unknown, TGroup = undefined>
  extends RenderAdapter<TLayer, TGroup, EsriMap, Layer> {
  private readonly container: GroupLayer | undefined;

  constructor(map: EsriMap, ...[options = {}]: ArcGISAdapterArgs<TLayer>) {
    super(map, { renderLayer: options.renderLayer ?? defaultArcGISRenderLayer, disposeLayer: options.disposeLayer });
    this.container = options.container;
  }

  protected placeLayer({ rendered, visible, computedOpacity }: RenderedLayer<Layer>): void {
    rendered.visible = visible;
    rendered.opacity = computedOpacity;
    if (!this.layerCollection.includes(rendered)) {
      this.layerCollection.add(rendered);
    }
  }

  protected eraseLayer(_layerId: string, rendered: Layer, next?: Layer): void {
    if (next) {
      this.layerCollection.add(next, this.layerCollection.indexOf(rendered));
    }
    this.layerCollection.remove(rendered);
  }

  protected setLayerVisible({ rendered, visible }: RenderedLayer<Layer>): void {
    rendered.visible = visible;
  }

  protected setLayerOpacity({ rendered, computedOpacity }: RenderedLayer<Layer>): void {
    rendered.opacity = computedOpacity;
  }

  protected restackLayers(bottomToTop: RenderedLayer<Layer>[]): void {
    const bottom = Math.min(...bottomToTop.map(({ rendered }) => this.layerCollection.indexOf(rendered)));
    bottomToTop.forEach(({ rendered }, index) => this.layerCollection.reorder(rendered, bottom + index));
  }

  private get layerCollection(): Collection<Layer> {
    return this.container?.layers ?? this.map.layers;
  }
}
