import type {
  LayerInfo,
  LayerManager,
  LayerManagerAdapter,
  LayerManagerCallbacks,
  ManagedLayerInfo,
} from '@ulm/core';

import type L from 'leaflet';
import type { LeafletAdapterOptions, LeafletLayerFactory } from './types';

import { createDefaultLeafletFactory } from './default-factory';

export class LeafletLayerManagerAdapter<TLayer = unknown, TGroup = TLayer>
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

  register(_layerManager: LayerManager<TLayer, TGroup>, _callbacks: LayerManagerCallbacks<TLayer, TGroup>): void {
    // Callbacks available for subclasses that need to query manager state.
  }

  unregister(): void {
    for (const layer of this.leafletLayers.values()) {
      this.map.removeLayer(layer);
    }
    this.leafletLayers.clear();
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
    const leafletLayer = this.layerFactory(info as LayerInfo<TLayer>, this.map);
    if (!leafletLayer) {
      return;
    }

    this.leafletLayers.set(info.layerId, leafletLayer);

    if (info.visible) {
      leafletLayer.addTo(this.map);
    }

    this.options.hooks?.onLayerAdded?.(info as LayerInfo<TLayer>, leafletLayer);
  }

  onLayerRemoved(layerId: string): void {
    const leafletLayer = this.leafletLayers.get(layerId);
    if (!leafletLayer) {
      return;
    }
    this.map.removeLayer(leafletLayer);
    this.leafletLayers.delete(layerId);
    this.options.hooks?.onLayerRemoved?.(layerId, leafletLayer);
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
    this.options.hooks?.onVisibilityChanged?.(info as LayerInfo<TLayer>, visible, leafletLayer);
  }

  onOpacityChanged(info: ManagedLayerInfo<TLayer, TGroup>, computedOpacity: number): void {
    const leafletLayer = this.leafletLayers.get(info.layerId);
    if (!leafletLayer) {
      return;
    }
    if ('setOpacity' in leafletLayer && typeof (leafletLayer as L.GridLayer).setOpacity === 'function') {
      (leafletLayer as L.GridLayer).setOpacity(computedOpacity);
    }
    this.options.hooks?.onOpacityChanged?.(info as LayerInfo<TLayer>, info.opacity, computedOpacity, leafletLayer);
  }

  onLayerDataChanged(info: ManagedLayerInfo<TLayer, TGroup>): void {
    const leafletLayer = this.leafletLayers.get(info.layerId);
    if (!leafletLayer) {
      return;
    }
    this.options.hooks?.onLayerDataChanged?.(info as LayerInfo<TLayer>, leafletLayer);
  }
}
