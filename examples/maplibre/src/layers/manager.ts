import type { MapLibreLayerStyle } from '@ulm/maplibre';
import { LayerManager } from '@ulm/core';
import { buildings, elevation, parks, railways, satellite, waterways } from './styles';

// The data each layer carries in this demo: the MapLibre style that draws it.
export type LayerData = MapLibreLayerStyle;

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

function addLayer(parentId: string, layerId: string, layerName: string, layerData: LayerData, visible = true): void {
  manager.addLayer({
    layerConfig: { layerId, layerName, layerType: 'layer', parentId, layerData },
    visible,
    position: 'top',
  });
}

function addStartingLayers(): void {
  addGroup('tiles', 'Raster tiles');
  addLayer('tiles', 'satellite', 'Satellite imagery', satellite, false);
  addLayer('tiles', 'elevation', 'Elevation', elevation, false);

  addGroup('vectors', 'OpenFreeMap vector tiles');
  addLayer('vectors', 'parks', 'Parks', parks);
  addLayer('vectors', 'waterways', 'Waterways', waterways);
  addLayer('vectors', 'railways', 'Railways', railways);
  addLayer('vectors', 'buildings', '3D buildings (zoom in)', buildings);
}

addStartingLayers();
