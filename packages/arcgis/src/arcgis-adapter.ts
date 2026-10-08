import type Layer from '@arcgis/core/layers/Layer.js';
import type EsriMap from '@arcgis/core/Map.js';
import type { RenderedLayer } from '@ulm/core';
import type { ArcGISAdapterArgs } from './types';

import GroupLayer from '@arcgis/core/layers/GroupLayer.js';
import { RenderAdapter } from '@ulm/core';
import { defaultArcGISRenderLayer } from './default-render-layer';

export class ArcGISLayerManagerAdapter<TLayer = unknown, TGroup = undefined>
  extends RenderAdapter<TLayer, TGroup, EsriMap, Layer> {
  private readonly container = new GroupLayer();

  constructor(map: EsriMap, ...[options = {}]: ArcGISAdapterArgs<TLayer>) {
    super(map, { renderLayer: options.renderLayer ?? defaultArcGISRenderLayer, disposeLayer: options.disposeLayer });
  }

  register(): void {
    this.map.add(this.container);
  }

  override unregister(): void {
    super.unregister();
    this.map.remove(this.container);
  }

  protected placeLayer({ rendered, visible, computedOpacity }: RenderedLayer<Layer>): void {
    rendered.visible = visible;
    rendered.opacity = computedOpacity;
    this.container.add(rendered);
  }

  protected eraseLayer(_layerId: string, rendered: Layer): void {
    this.container.remove(rendered);
  }

  protected setLayerVisible({ rendered, visible }: RenderedLayer<Layer>): void {
    rendered.visible = visible;
  }

  protected setLayerOpacity({ rendered, computedOpacity }: RenderedLayer<Layer>): void {
    rendered.opacity = computedOpacity;
  }

  protected restackLayers(bottomToTop: RenderedLayer<Layer>[]): void {
    bottomToTop.forEach(({ rendered }, index) => this.container.layers.reorder(rendered, index));
  }
}
