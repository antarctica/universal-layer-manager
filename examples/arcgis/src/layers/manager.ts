import type Layer from '@arcgis/core/layers/Layer.js';
import type { ArcGISLayerData } from '@ulm/arcgis';
import { LayerManager } from '@ulm/core';
import { bedTopography, coastline, contours, groundingLine, iceThickness, lakes, rockOutcrop } from './layers';

// The data each layer carries in this demo: the ArcGIS layer that shows it.
export type LayerData = ArcGISLayerData;

// The manager lives for the whole app, like a store. The map attaches to it while the map is mounted.
export const manager = new LayerManager<LayerData>({
  allowNestedGroupLayers: true,
  onError: (error) => console.warn(error.message),
});

function addGroup(layerId: string, layerName: string, enabled = true): void {
  manager.addGroup({
    layerConfig: { layerId, layerName, layerType: 'layerGroup' },
    enabled,
    position: 'top',
  });
}

// `enabled` switches a layer on without switching on the groups above it, as `visible` would.
function addLayer(parentId: string, layerId: string, layerName: string, arcgisLayer: Layer, enabled = true): void {
  manager.addLayer({
    layerConfig: { layerId, layerName, layerType: 'layer', parentId, layerData: { arcgisLayer } },
    enabled,
    position: 'top',
  });
}

function addStartingLayers(): void {
  addGroup('ice-sheet', 'Ice sheet (Bedmap3)', false);
  addLayer('ice-sheet', 'bed-topography', 'Bed topography', bedTopography, false);
  addLayer('ice-sheet', 'ice-thickness', 'Ice thickness', iceThickness, true);
  addLayer('ice-sheet', 'grounding-line', 'Grounding line', groundingLine, false);

  addGroup('add', 'Digital Database');
  addLayer('add', 'rock-outcrop', 'Rock outcrop', rockOutcrop, false);
  addLayer('add', 'lakes', 'Lakes', lakes, false);
  addLayer('add', 'contours', 'Contours', contours, false);
  addLayer('add', 'coastline', 'Coastline', coastline);
}

addStartingLayers();
