import type { OpenLayersLayerData } from '@ulm/openlayers';
import type BaseLayer from 'ol/layer/Base.js';
import { LayerManager } from '@ulm/core';
import { buildings, hillshade, parks, railways, satellite, waterways } from './startingLayers';

// The data each layer carries in this demo: the OpenLayers layer that draws it.
export type LayerData = OpenLayersLayerData;

export const LONDON: [number, number] = [-0.1, 51.505];

// The manager lives for the whole app, like a store. The map attaches to it while the map is mounted.
export const manager = new LayerManager<LayerData>({
  allowNestedGroupLayers: true,
  onError: (error) => console.warn(error.message),
});

function addGroup(layerId: string, layerName: string): void {
  manager.addGroup({
    layerConfig: { layerId, layerName, layerType: 'layerGroup' },
    visible: true,
    position: 'top',
  });
}

function addLayer(parentId: string, layerId: string, layerName: string, openlayersLayer: BaseLayer, visible = true): void {
  manager.addLayer({
    layerConfig: { layerId, layerName, layerType: 'layer', parentId, layerData: { openlayersLayer } },
    visible,
    position: 'top',
  });
}

function addStartingLayers(): void {
  addGroup('tiles', 'Raster tiles');
  addLayer('tiles', 'satellite', 'Satellite imagery', satellite, false);
  addLayer('tiles', 'hillshade', 'Hillshade', hillshade, false);

  addGroup('vectors', 'OpenFreeMap vector tiles');
  addLayer('vectors', 'parks', 'Parks', parks);
  addLayer('vectors', 'waterways', 'Waterways', waterways);
  addLayer('vectors', 'railways', 'Railways', railways);
  addLayer('vectors', 'buildings', 'Buildings (zoom in)', buildings);
}

addStartingLayers();
