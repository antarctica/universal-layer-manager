import { LayerManager } from '@ulm/core';
import * as L from 'leaflet';

// The data each layer carries in this demo: the Leaflet layer that draws it.
export interface LayerData {
  leafletLayer: L.Layer;
}

export const LONDON: L.LatLngTuple = [51.505, -0.09];

// The manager lives for the whole app, like a store. The map attaches to it while the map is mounted.
export const manager = new LayerManager<LayerData>({
  allowNestedGroupLayers: true,
  onError: (error) => console.warn(error.message),
});

// Overlapping circles, so raising or lowering one shows the stacking on the map.
const SHAPES = [
  { layerId: 'red-circle', layerName: 'Red circle', color: '#d62728', center: [51.505, -0.105] },
  { layerId: 'green-circle', layerName: 'Green circle', color: '#2ca02c', center: [51.512, -0.09] },
  { layerId: 'blue-circle', layerName: 'Blue circle', color: '#1f77b4', center: [51.505, -0.075] },
] as const;

function addStartingLayers(): void {
  manager.addGroup({
    layerConfig: { layerId: 'baselayers', layerName: 'Base Layers', layerType: 'layerGroup', layerData: undefined },
    visible: true,
  });

  manager.addLayer({
    layerConfig: {
      layerId: 'osm',
      layerName: 'OpenStreetMap',
      layerType: 'layer',
      parentId: 'baselayers',
      layerData: {
        leafletLayer: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }),
      },
    },
    visible: true,
  });

  manager.addLayer({
    layerConfig: {
      layerId: 'imagery',
      layerName: 'Esri World Imagery',
      layerType: 'layer',
      parentId: 'baselayers',
      layerData: {
        leafletLayer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        }),
      },
    },
    visible: true,
  });

  manager.addGroup({
    layerConfig: { layerId: 'shapes', layerName: 'Shapes', layerType: 'layerGroup', layerData: undefined },
    visible: true,
    position: 'top',
  });

  SHAPES.forEach(({ layerId, layerName, color, center }) => {
    manager.addLayer({
      layerConfig: {
        layerId,
        layerName,
        layerType: 'layer',
        parentId: 'shapes',
        layerData: { leafletLayer: L.circle([...center], { radius: 1200, color, fillOpacity: 0.8 }) },
      },
      visible: true,
      position: 'top',
    });
  });

  manager.addLayer({
    layerConfig: {
      layerId: 'london-marker',
      layerName: 'London Marker',
      layerType: 'layer',
      layerData: { leafletLayer: L.marker(LONDON).bindPopup('This is London!') },
    },
    visible: true,
    position: 'top',
  });
}

addStartingLayers();
