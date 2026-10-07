import * as L from 'leaflet';
import * as React from 'react';
import { LayerManagerContext } from '../layers/LayerManagerContext';
import { LONDON } from '../layers/startingLayers';
import styles from './LayerList.module.css';

function randomId(): string {
  return Math.random().toString(36).substring(7);
}

// Within about 5 km of London, so a new marker lands on the visible map.
function randomPointNearLondon(): L.LatLngTuple {
  const jitter = (): number => (Math.random() * 2 - 1) * 0.05;
  return [LONDON[0] + jitter(), LONDON[1] + jitter()];
}

// Adds a marker or a group inside `parentId`, or at the top level when it is null.
export function AddLayerButtons({ parentId }: { parentId: string | null }): React.ReactElement {
  const managerRef = LayerManagerContext.useActorRef();

  const addMarker = (): void => {
    const id = randomId();
    managerRef.send({
      type: 'LAYER.ADD',
      params: {
        layerConfig: {
          layerId: id,
          layerName: `Marker ${id}`,
          layerType: 'layer',
          parentId,
          layerData: { leafletLayer: L.marker(randomPointNearLondon()).bindPopup(`Marker ${id}`) },
        },
        visible: true,
      },
    });
  };

  const addGroup = (): void => {
    const id = randomId();
    managerRef.send({
      type: 'LAYER.ADD',
      params: {
        layerConfig: { layerId: id, layerName: `Group ${id}`, layerType: 'layerGroup', parentId },
        visible: true,
      },
    });
  };

  return (
    <div className={styles.controls}>
      <button type="button" className={styles.addButton} onClick={addMarker}>+ Layer</button>
      <button type="button" className={styles.addButton} onClick={addGroup}>+ Group</button>
    </div>
  );
}
