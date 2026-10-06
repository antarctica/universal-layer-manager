import type { AddManagedLayerParams } from '@ulm/core';
import type { LayerData, ManagerRef } from './LayerManagerContext';
import * as L from 'leaflet';

export const LONDON: L.LatLngTuple = [51.505, -0.09];

// Overlapping circles, so raising or lowering one shows the stacking on the map.
const SHAPES = [
  { layerId: 'red-circle', layerName: 'Red circle', color: '#d62728', center: [51.505, -0.105] },
  { layerId: 'green-circle', layerName: 'Green circle', color: '#2ca02c', center: [51.512, -0.09] },
  { layerId: 'blue-circle', layerName: 'Blue circle', color: '#1f77b4', center: [51.505, -0.075] },
] as const;

/** Adds the layers the demo starts with to `managerRef`. Returns a function that removes them again. */
export function addStartingLayers(managerRef: ManagerRef): () => void {
  const add = (params: AddManagedLayerParams<LayerData>): void => managerRef.send({ type: 'LAYER.ADD', params });

  add({
    layerConfig: { layerId: 'baselayers', layerName: 'Base Layers', layerType: 'layerGroup', layerData: undefined },
    visible: true,
  });

  add({
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

  add({
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

  add({
    layerConfig: { layerId: 'shapes', layerName: 'Shapes', layerType: 'layerGroup', layerData: undefined },
    visible: true,
    position: 'top',
  });

  SHAPES.forEach(({ layerId, layerName, color, center }) => {
    add({
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

  add({
    layerConfig: {
      layerId: 'london-marker',
      layerName: 'London Marker',
      layerType: 'layer',
      layerData: { leafletLayer: L.marker(LONDON).bindPopup('This is London!') },
    },
    visible: true,
    position: 'top',
  });

  return () => managerRef.send({ type: 'RESET' });
}
