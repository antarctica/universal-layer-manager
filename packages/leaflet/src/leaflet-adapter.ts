import type {
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
    for (const layer of this.leafletLayers.values()) {
      this.map.removeLayer(layer);
    }
    this.leafletLayers.clear();
    this.map.getPane(CONTAINER_PANE)?.remove();
  }

  getContext(): L.Map {
    return this.map;
  }

  // --------------------------------------------------------------------------
  // Layer lifecycle — called directly by LayerManager (push model)
  // --------------------------------------------------------------------------

  onLayerAdded(info: ManagedLayerInfo<TLayer, TGroup>): void {
    if (info.layerType !== 'layer') {
      return;
    }
    const leafletLayer = this.layerFactory(info, this.map);
    if (!leafletLayer) {
      return;
    }

    this.leafletLayers.set(info.layerId, leafletLayer);
    placeInPane(leafletLayer, this.createLayerPane(info.layerId));
    this.fadeLayerPane(info.layerId, info.computedOpacity);

    if (info.visible) {
      leafletLayer.addTo(this.map);
    }

    this.options.hooks?.onLayerAdded?.(info, leafletLayer);
  }

  onLayerRemoved(layerId: string): void {
    const leafletLayer = this.leafletLayers.get(layerId);
    if (!leafletLayer) {
      return;
    }
    this.map.removeLayer(leafletLayer);
    this.map.getPane(layerPaneName(layerId))?.remove();
    this.leafletLayers.delete(layerId);
    this.options.hooks?.onLayerRemoved?.(layerId, leafletLayer);
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
    this.options.hooks?.onVisibilityChanged?.(info, visible, leafletLayer);
  }

  onEnabledChanged(info: ManagedLayerInfo<TLayer, TGroup>, enabled: boolean): void {
    const leafletLayer = this.leafletLayers.get(info.layerId);
    if (info.layerType !== 'layer' || !leafletLayer) {
      return;
    }
    this.options.hooks?.onEnabledChanged?.(info, enabled, leafletLayer);
  }

  onOpacityChanged(info: ManagedLayerInfo<TLayer, TGroup>, computedOpacity: number): void {
    const leafletLayer = this.leafletLayers.get(info.layerId);
    if (info.layerType !== 'layer' || !leafletLayer) {
      return;
    }
    this.fadeLayerPane(info.layerId, computedOpacity);
    this.options.hooks?.onOpacityChanged?.(info, info.opacity, computedOpacity, leafletLayer);
  }

  onLayerDataChanged(info: ManagedLayerInfo<TLayer, TGroup>): void {
    const leafletLayer = this.leafletLayers.get(info.layerId);
    if (info.layerType !== 'layer' || !leafletLayer) {
      return;
    }
    this.options.hooks?.onLayerDataChanged?.(info, leafletLayer);
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

  private createLayerPane(layerId: string): string {
    const name = layerPaneName(layerId);
    this.attachPane(name, this.getContainerPane());
    return name;
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
