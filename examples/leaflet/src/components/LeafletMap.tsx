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
const CARTO_LAYER_ID = 'carto';
const LONDON_MARKER_ID = 'marker1';

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
        layerId: CARTO_LAYER_ID,
        layerName: 'CartoDB Positron',
        parentId: BASE_LAYER_GROUP_ID,
        layerData: {
          leafletLayer: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          }),
        },
      },
      visible: false,
    });

    manager.addLayer({
      layerConfig: {
        layerType: 'layer',
        layerId: LONDON_MARKER_ID,
        layerName: 'London Marker',
        parentId: BASE_LAYER_GROUP_ID,
        layerData: {
          leafletLayer: L.marker(LONDON_CENTER).bindPopup('This is London!'),
        },
      },
      visible: true,
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
