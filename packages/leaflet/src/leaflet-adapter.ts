import type {
  LayerInfo,
  LayerManagerAdapter,
  ManagedLayerInfo,
} from '@ulm/core';

import type L from 'leaflet';
import type { LeafletAdapterArgs } from './types';

import { RenderedLayers } from '@ulm/core';
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
implements LayerManagerAdapter<TLayer, TGroup> {
  private readonly map: L.Map;
  private readonly leafletLayers: RenderedLayers<TLayer, L.Map, L.Layer>;

  constructor(map: L.Map, ...[options = {}]: LeafletAdapterArgs<TLayer>) {
    this.map = map;
    this.leafletLayers = new RenderedLayers({
      map,
      renderLayer: options.renderLayer ?? defaultLeafletRenderLayer,
      disposeLayer: options.disposeLayer,
      place: (info, leafletLayer) => this.placeLayer(info, leafletLayer),
      erase: (_layerId, leafletLayer) => this.map.removeLayer(leafletLayer),
    });
  }

  // --------------------------------------------------------------------------
  // Lifecycle — called by LayerManager
  // --------------------------------------------------------------------------

  unregister(): void {
    this.leafletLayers.clear();
    this.map.getPane(CONTAINER_PANE)?.remove();
  }

  // --------------------------------------------------------------------------
  // Layer lifecycle — called directly by LayerManager (push model)
  // --------------------------------------------------------------------------

  onLayerAdded(info: ManagedLayerInfo<TLayer, TGroup>): void {
    if (info.layerType !== 'layer') {
      return;
    }
    this.createLayerPane(info.layerId);
    this.fadeLayerPane(info.layerId, info.computedOpacity);
    this.leafletLayers.add(info);
  }

  onLayerRemoved(layerId: string): void {
    this.map.getPane(layerPaneName(layerId))?.remove();
    this.leafletLayers.remove(layerId);
  }

  onVisibilityChanged(info: ManagedLayerInfo<TLayer, TGroup>, visible: boolean): void {
    const leafletLayer = this.leafletLayers.get(info.layerId);
    if (!leafletLayer) {
      return;
    }
    if (visible) {
      leafletLayer.addTo(this.map);
    } else {
      this.map.removeLayer(leafletLayer);
    }
  }

  onOpacityChanged(info: ManagedLayerInfo<TLayer, TGroup>, computedOpacity: number): void {
    this.fadeLayerPane(info.layerId, computedOpacity);
  }

  // renderLayer can read the time, so a new time draws the layer again as new data does.
  onTimeInfoChanged(info: ManagedLayerInfo<TLayer, TGroup>): void {
    this.leafletLayers.update(info);
  }

  onLayerDataChanged(info: ManagedLayerInfo<TLayer, TGroup>): void {
    this.leafletLayers.update(info);
  }

  onOrderChanged(layerOrder: string[]): void {
    let zIndex = 1;
    for (const layerId of layerOrder) {
      const pane = this.map.getPane(layerPaneName(layerId));
      if (pane) {
        pane.style.zIndex = String(zIndex);
        zIndex += 1;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  // Draws a layer's Leaflet layer in the layer's pane, and on the map if the layer is showing.
  private placeLayer(info: LayerInfo<TLayer>, leafletLayer: L.Layer): void {
    placeInPane(leafletLayer, layerPaneName(info.layerId));
    if (info.visible) {
      leafletLayer.addTo(this.map);
    }
  }

  private createLayerPane(layerId: string): void {
    this.attachPane(layerPaneName(layerId), this.getContainerPane());
  }

  private fadeLayerPane(layerId: string, computedOpacity: number): void {
    const pane = this.map.getPane(layerPaneName(layerId));
    if (pane) {
      pane.style.opacity = String(computedOpacity);
    }
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
