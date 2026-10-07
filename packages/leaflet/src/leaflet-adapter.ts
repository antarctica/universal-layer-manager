import type {
  LayerInfo,
  LayerManagerAdapter,
  ManagedLayerInfo,
} from '@ulm/core';

import type L from 'leaflet';
import type { LeafletAdapterOptions, LeafletLayerFactory } from './types';

import { createDefaultLeafletFactory } from './default-factory';

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
  private readonly options: LeafletAdapterOptions<TLayer>;
  private readonly layerFactory: LeafletLayerFactory<TLayer>;
  private readonly leafletLayers = new Map<string, L.Layer>();

  constructor(map: L.Map, options: LeafletAdapterOptions<TLayer> = {}) {
    this.map = map;
    this.options = options;
    this.layerFactory = options.layerFactory ?? createDefaultLeafletFactory<TLayer>();
  }

  // --------------------------------------------------------------------------
  // Lifecycle — called by LayerManager
  // --------------------------------------------------------------------------

  unregister(): void {
    for (const layerId of [...this.leafletLayers.keys()]) {
      this.eraseLayer(layerId);
    }
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

    const leafletLayer = this.layerFactory(info, this.map);
    if (leafletLayer) {
      this.drawLayer(info, leafletLayer);
    }
  }

  onLayerRemoved(layerId: string): void {
    this.map.getPane(layerPaneName(layerId))?.remove();
    this.eraseLayer(layerId);
  }

  onVisibilityChanged(info: ManagedLayerInfo<TLayer, TGroup>, visible: boolean): void {
    const leafletLayer = this.leafletLayers.get(info.layerId);
    if (info.layerType !== 'layer' || !leafletLayer) {
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

  // The factory can read the time, so a new time redraws the layer as new data does.
  onTimeInfoChanged(info: ManagedLayerInfo<TLayer, TGroup>): void {
    this.onLayerDataChanged(info);
  }

  onLayerDataChanged(info: ManagedLayerInfo<TLayer, TGroup>): void {
    if (info.layerType === 'layer') {
      this.drawFromFactory(info);
    }
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

  // Runs the factory with the Leaflet layer already drawn, and draws what it returns in that layer's place.
  private drawFromFactory(info: LayerInfo<TLayer>): L.Layer | null {
    const previous = this.leafletLayers.get(info.layerId);
    const leafletLayer = this.layerFactory(info, this.map, previous);
    if (leafletLayer !== previous) {
      this.eraseLayer(info.layerId);
      if (leafletLayer) {
        this.drawLayer(info, leafletLayer);
      }
    }
    return leafletLayer;
  }

  // Draws a layer's Leaflet layer in the layer's pane, and on the map if the layer is showing.
  private drawLayer(info: LayerInfo<TLayer>, leafletLayer: L.Layer): void {
    this.leafletLayers.set(info.layerId, leafletLayer);
    placeInPane(leafletLayer, layerPaneName(info.layerId));
    if (info.visible) {
      leafletLayer.addTo(this.map);
    }
  }

  // Takes a layer's Leaflet layer off the map and disposes of it. The layer's pane stays.
  private eraseLayer(layerId: string): void {
    const leafletLayer = this.leafletLayers.get(layerId);
    if (leafletLayer) {
      this.map.removeLayer(leafletLayer);
      this.leafletLayers.delete(layerId);
      this.options.disposeLayer?.(leafletLayer, layerId);
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
