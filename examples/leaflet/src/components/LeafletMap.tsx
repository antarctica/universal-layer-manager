import type { LatLngExpression, Map } from 'leaflet';
import type { LayerActor } from 'universal-layer-manager';
import type { ClientLayerManagerActor, LayerData } from '../layerManager/LayerManagerProvider';

import * as L from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, useMap } from 'react-leaflet';

import { findManagedLayerById, getLayerDataFromLayerId } from 'universal-layer-manager';
import { LayerManagerContext } from '../layerManager/LayerManagerProvider';
import 'leaflet/dist/leaflet.css';

const LONDON_CENTER: LatLngExpression = [51.505, -0.09];
const DEFAULT_ZOOM = 13;
const BASE_LAYER_GROUP_ID = 'baselayers';
const OSM_LAYER_ID = 'osm';
const CARTO_LAYER_ID = 'carto';
const LONDON_MARKER_ID = 'marker1';

interface LeafletLayerSyncProps {
  map: Map;
}

function getLayerActor(manager: ClientLayerManagerActor, layerId: string): LayerActor | undefined {
  const snapshot = manager.getSnapshot();
  return findManagedLayerById(snapshot.context.layers, layerId)?.layerActor;
}

function getLeafletLayer(layerActor: LayerActor): L.Layer | undefined {
  const snapshot = layerActor.getSnapshot();
  const layerData = snapshot.context.layerData as LayerData | undefined;
  if (!layerData) {
    return undefined;
  }
  return layerData.leafletLayer;
}

function LeafletLayerSync({ map }: LeafletLayerSyncProps) {
  const manager = LayerManagerContext.useActorRef();

  const updateLayerVisibility = (layerId: string, visible: boolean) => {
    const layerActor = getLayerActor(manager, layerId);
    if (!layerActor) {
      return;
    }

    const leafletLayer = getLeafletLayer(layerActor);
    if (!leafletLayer) {
      return;
    }

    if (visible && !map.hasLayer(leafletLayer)) {
      leafletLayer.addTo(map);
    }

    if (!visible && map.hasLayer(leafletLayer)) {
      map.removeLayer(leafletLayer);
    }
  };

  const updateLayerOpacity = (layerId: string, computedOpacity: number) => {
    const layerActor = getLayerActor(manager, layerId);
    if (!layerActor) {
      return;
    }

    const leafletLayer = getLeafletLayer(layerActor);

    if (leafletLayer && 'setOpacity' in leafletLayer) {
      (leafletLayer as L.TileLayer).setOpacity(computedOpacity);
    }
  };

  const cleanupAllLayers = () => {
    manager.getSnapshot().context.layers.forEach((layer) => {
      const leafletLayer = getLeafletLayer(layer.layerActor);
      if (leafletLayer && map.hasLayer(leafletLayer)) {
        map.removeLayer(leafletLayer);
      }
    });
  };

  useEffect(() => {
    const addedSub = manager.on('LAYER.ADDED', ({ layerId, visible }) => {
      const layerData = getLayerDataFromLayerId(manager.getSnapshot().context.layers, layerId);
      if (!layerData || !layerData.leafletLayer) {
        return;
      }

      if (visible && !map.hasLayer(layerData.leafletLayer)) {
        map.addLayer(layerData.leafletLayer);
      }
    });

    const visibilitySub = manager.on('LAYER.VISIBILITY_CHANGED', ({ layerId, visible }) => {
      updateLayerVisibility(layerId, visible);
    });

    const opacitySub = manager.on('LAYER.OPACITY_CHANGED', ({ layerId, computedOpacity }) => {
      updateLayerOpacity(layerId, computedOpacity);
    });

    return () => {
      addedSub.unsubscribe();
      visibilitySub.unsubscribe();
      opacitySub.unsubscribe();
      cleanupAllLayers();
      manager.send({ type: 'RESET' });
    };
  }, [map, manager]);

  return null;
}

// Creates some initial demo layers and registers them with the layer manager.
function MapLayerInitializer() {
  const map = useMap();
  const manager = LayerManagerContext.useActorRef();

  useEffect(() => {
    const layerGroups = [
      {
        layerId: BASE_LAYER_GROUP_ID,
        layerName: 'Base Layers',
        layerType: 'layerGroup' as const,
        visible: true,
      },
    ];

    const layers = [
      {
        layerId: OSM_LAYER_ID,
        layerName: 'OpenStreetMap',
        layerType: 'layer' as const,
        parentId: BASE_LAYER_GROUP_ID,
        leafletLayer: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }),
        visible: true,
      },
      {
        layerId: CARTO_LAYER_ID,
        layerName: 'CartoDB Positron',
        layerType: 'layer' as const,
        parentId: BASE_LAYER_GROUP_ID,
        leafletLayer: L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          },
        ),
        visible: false,
      },
      {
        layerId: LONDON_MARKER_ID,
        layerName: 'London Marker',
        layerType: 'layer' as const,
        leafletLayer: L.marker(LONDON_CENTER).bindPopup('This is London!'),
        visible: true,
      },
    ];

    layerGroups.forEach((layerGroup) => {
      manager.send({
        type: 'LAYER.ADD',
        params: {
          layerConfig: {
            layerId: layerGroup.layerId,
            layerName: layerGroup.layerName,
            layerType: layerGroup.layerType,
            parentId: null,
            layerData: undefined,
          },
          visible: layerGroup.visible,
        },
      });
    });

    layers.forEach((layer) => {
      manager.send({
        type: 'LAYER.ADD',
        params: {
          layerConfig: {
            layerId: layer.layerId,
            layerName: layer.layerName,
            layerType: layer.layerType,
            parentId: layer.parentId ?? null,
            layerData: {
              leafletLayer: layer.leafletLayer,
            },
          },
          visible: layer.visible,
        },
      });
    });
  }, [manager, map]);

  return <LeafletLayerSync map={map} />;
}

export function LeafletMap() {
  return (
    <MapContainer center={LONDON_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }}>
      <MapLayerInitializer />
    </MapContainer>
  );
}
