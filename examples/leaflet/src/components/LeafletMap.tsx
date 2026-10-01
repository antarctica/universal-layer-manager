import type { LatLngExpression } from 'leaflet';

import type { LayerData } from '../layerManager/LayerManagerProvider';
import { LeafletLayerManagerAdapter } from '@ulm/leaflet';
import * as L from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, useMap } from 'react-leaflet';
import { useLayerManager } from '../layerManager/LayerManagerProvider';
import 'leaflet/dist/leaflet.css';

const LONDON_CENTER: LatLngExpression = [51.505, -0.09];
const DEFAULT_ZOOM = 13;
const BASE_LAYER_GROUP_ID = 'baselayers';
const OSM_LAYER_ID = 'osm';
const IMAGERY_LAYER_ID = 'imagery';
const LONDON_MARKER_ID = 'marker1';
const SHAPES_GROUP_ID = 'shapes';

// Overlapping circles, so raising or lowering one shows the stacking on the map.
const SHAPES = [
  { layerId: 'red-circle', layerName: 'Red circle', color: '#d62728', center: [51.505, -0.105] },
  { layerId: 'green-circle', layerName: 'Green circle', color: '#2ca02c', center: [51.512, -0.09] },
  { layerId: 'blue-circle', layerName: 'Blue circle', color: '#1f77b4', center: [51.505, -0.075] },
] as const;

function MapInitializer() {
  const map = useMap();
  const manager = useLayerManager();

  useEffect(() => {
    const adapter = new LeafletLayerManagerAdapter<LayerData, undefined>(map);
    manager.reset();
    manager.setAdapter(adapter);

    manager.addGroup({
      layerConfig: {
        layerId: BASE_LAYER_GROUP_ID,
        layerName: 'Base Layers',
        parentId: null,
        layerData: undefined,
        layerType: 'layerGroup',
      },
      visible: true,
    });

    manager.addLayer({
      layerConfig: {
        layerType: 'layer',
        layerId: OSM_LAYER_ID,
        layerName: 'OpenStreetMap',
        parentId: BASE_LAYER_GROUP_ID,
        layerData: {
          leafletLayer: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }),
        },
      },
      visible: true,
    });

    manager.addLayer({
      layerConfig: {
        layerType: 'layer',
        layerId: IMAGERY_LAYER_ID,
        layerName: 'Esri World Imagery',
        parentId: BASE_LAYER_GROUP_ID,
        layerData: {
          leafletLayer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
          }),
        },
      },
      visible: true,
    });

    manager.addGroup({
      layerConfig: {
        layerId: SHAPES_GROUP_ID,
        layerName: 'Shapes',
        parentId: null,
        layerData: undefined,
        layerType: 'layerGroup',
      },
      visible: true,
      position: 'top',
    });

    SHAPES.forEach(({ layerId, layerName, color, center }) => {
      manager.addLayer({
        layerConfig: {
          layerType: 'layer',
          layerId,
          layerName,
          parentId: SHAPES_GROUP_ID,
          layerData: {
            leafletLayer: L.circle([...center], { radius: 1200, color, fillOpacity: 0.8 }),
          },
        },
        visible: true,
        position: 'top',
      });
    });

    manager.addLayer({
      layerConfig: {
        layerType: 'layer',
        layerId: LONDON_MARKER_ID,
        layerName: 'London Marker',
        parentId: null,
        layerData: {
          leafletLayer: L.marker(LONDON_CENTER).bindPopup('This is London!'),
        },
      },
      visible: true,
      position: 'top',
    });
  }, [map, manager]);

  return null;
}

export function LeafletMap() {
  return (
    <MapContainer center={LONDON_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }}>
      <MapInitializer />
    </MapContainer>
  );
}
