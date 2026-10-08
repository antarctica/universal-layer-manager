import type Layer from '@arcgis/core/layers/Layer.js';
import type { ArcGISLayerData } from '@ulm/arcgis';
import { LayerManager } from '@ulm/core';
import { assetLocations, coastline, contours, lakes, rockOutcrop } from './layers';

// The data each layer carries in this demo: the ArcGIS layer that shows it.
export type LayerData = ArcGISLayerData;

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

function addLayer(parentId: string, layerId: string, layerName: string, arcgisLayer: Layer, visible = true): void {
  manager.addLayer({
    layerConfig: { layerId, layerName, layerType: 'layer', parentId, layerData: { arcgisLayer } },
    visible,
    position: 'top',
  });
}

function addStartingLayers(): void {
  addGroup('add', 'Digital Database');
  addLayer('add', 'rock-outcrop', 'Rock outcrop', rockOutcrop, false);
  addLayer('add', 'lakes', 'Lakes', lakes, false);
  addLayer('add', 'contours', 'Contours', contours);
  addLayer('add', 'coastline', 'Coastline', coastline);

  addGroup('operations', 'Operations');
  addLayer('operations', 'asset-locations', 'BAS assets', assetLocations, false);
}

addStartingLayers();
