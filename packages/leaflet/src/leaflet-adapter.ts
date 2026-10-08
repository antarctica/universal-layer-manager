import type { RenderedLayer } from '@ulm/core';

import type L from 'leaflet';
import type { LeafletAdapterArgs } from './types';

import { RenderAdapter } from '@ulm/core';
import { defaultLeafletRenderLayer } from './default-render-layer';

const CONTAINER_PANE = 'ulmPane';
// Between Leaflet's overlay pane (400) and shadow pane (500), so popups, tooltips and unmanaged markers stay on top.
const CONTAINER_PANE_Z_INDEX = '450';

function layerPaneName(layerId: string): string {
  return `ulm-${layerId}`;
}

function placeInPane(layer: L.Layer, pane: string): void {
  layer.options.pane = pane;
  if ('shadowPane' in layer.options) {
    (layer.options as L.MarkerOptions).shadowPane = pane;
  }
  if (typeof (layer as L.LayerGroup).eachLayer === 'function') {
    (layer as L.LayerGroup).eachLayer((child) => placeInPane(child, pane));
  }
}

export class LeafletLayerManagerAdapter<TLayer = unknown, TGroup = undefined>
  extends RenderAdapter<TLayer, TGroup, L.Map, L.Layer> {
  constructor(map: L.Map, ...[options = {}]: LeafletAdapterArgs<TLayer>) {
    super(map, { renderLayer: options.renderLayer ?? defaultLeafletRenderLayer, disposeLayer: options.disposeLayer });
  }

  override unregister(): void {
    super.unregister();
    this.map.getPane(CONTAINER_PANE)?.remove();
  }

  // Draws a layer's Leaflet layer in a pane of its own, faded as the layer is, and on the map if the layer is showing.
  protected placeLayer({ layerId, rendered, visible, computedOpacity }: RenderedLayer<L.Layer>): void {
    const pane = this.attachPane(layerPaneName(layerId), this.getContainerPane());
    pane.style.opacity = String(computedOpacity);
    pane.style.display = computedOpacity === 0 ? 'none' : '';
    placeInPane(rendered, layerPaneName(layerId));
    if (visible) {
      rendered.addTo(this.map);
    }
  }

  protected eraseLayer(layerId: string, rendered: L.Layer, next?: L.Layer): void {
    this.map.removeLayer(rendered);
    if (!next) {
      this.map.getPane(layerPaneName(layerId))?.remove();
    }
  }

  protected setLayerVisible({ rendered, visible }: RenderedLayer<L.Layer>): void {
    if (visible) {
      rendered.addTo(this.map);
    } else {
      this.map.removeLayer(rendered);
    }
  }

  protected setLayerOpacity({ layerId, computedOpacity }: RenderedLayer<L.Layer>): void {
    const pane = this.map.getPane(layerPaneName(layerId));
    if (pane) {
      pane.style.opacity = String(computedOpacity);
      pane.style.display = computedOpacity === 0 ? 'none' : '';
    }
  }

  protected restackLayers(bottomToTop: RenderedLayer<L.Layer>[]): void {
    bottomToTop.forEach(({ layerId }, index) => {
      const pane = this.map.getPane(layerPaneName(layerId));
      if (pane) {
        pane.style.zIndex = String(index + 1);
      }
    });
  }

  private getContainerPane(): HTMLElement {
    const pane = this.attachPane(CONTAINER_PANE, this.map.getPanes().mapPane);
    pane.style.zIndex = CONTAINER_PANE_Z_INDEX;
    return pane;
  }

  // Leaflet keeps a removed pane under its name, so this reuses it and puts it back on the map.
  private attachPane(name: string, parent: HTMLElement): HTMLElement {
    const pane = this.map.getPane(name) ?? this.map.createPane(name, parent);
    parent.append(pane);
    return pane;
  }
}
