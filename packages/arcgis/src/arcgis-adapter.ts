import type Layer from '@arcgis/core/layers/Layer.js';
import type EsriMap from '@arcgis/core/Map.js';
import type { RenderedLayer } from '@ulm/core';
import type { ArcGISAdapterArgs } from './types';

import { RenderAdapter } from '@ulm/core';
import { defaultArcGISRenderLayer } from './default-render-layer';

export class ArcGISLayerManagerAdapter<TLayer = unknown, TGroup = undefined>
  extends RenderAdapter<TLayer, TGroup, EsriMap, Layer> {
  constructor(map: EsriMap, ...[options = {}]: ArcGISAdapterArgs<TLayer>) {
    super(map, { renderLayer: options.renderLayer ?? defaultArcGISRenderLayer, disposeLayer: options.disposeLayer });
  }

  protected placeLayer({ rendered, visible, computedOpacity }: RenderedLayer<Layer>): void {
    rendered.visible = visible;
    rendered.opacity = computedOpacity;
    this.map.add(rendered);
  }

  protected eraseLayer(_layerId: string, rendered: Layer): void {
    this.map.remove(rendered);
  }

  protected setLayerVisible({ rendered, visible }: RenderedLayer<Layer>): void {
    rendered.visible = visible;
  }

  protected setLayerOpacity({ rendered, computedOpacity }: RenderedLayer<Layer>): void {
    rendered.opacity = computedOpacity;
  }

  protected restackLayers(bottomToTop: RenderedLayer<Layer>[]): void {
    bottomToTop.forEach(({ rendered }, index) => this.map.reorder(rendered, index));
  }
}
