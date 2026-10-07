import type { LayerData } from '../layers/manager';
import * as React from 'react';
import { areaStyle, pointStyle } from '../layers/drawings';
import { useLayerManager } from '../layers/LayerManagerProvider';
import { LONDON } from '../layers/manager';
import styles from './LayerList.module.css';

function randomId(): string {
  return Math.random().toString(36).substring(7);
}

// Within about 15 km of central London, so a new point or area lands on the visible map.
function randomPlace(): [number, number] {
  const jitter = (): number => (Math.random() * 2 - 1) * 0.15;
  return [LONDON[0] + jitter(), LONDON[1] + jitter()];
}

function randomColour(): string {
  return `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0')}`;
}

// Adds a point, an area or a group inside `parentId`, or at the top level when it is null.
export function AddLayerButtons({ parentId }: { parentId: string | null }): React.ReactElement {
  const manager = useLayerManager();

  const addLayer = (layerId: string, layerName: string, layerData: LayerData): void => {
    manager.addLayer({ layerConfig: { layerId, layerName, layerType: 'layer', parentId, layerData }, visible: true, position: 'top' });
  };

  const addPoint = (): void => {
    const id = randomId();
    addLayer(id, `Point ${id}`, pointStyle(id, randomPlace()));
  };

  const addArea = (): void => {
    const id = randomId();
    addLayer(id, `Area ${id}`, areaStyle(id, randomPlace(), randomColour()));
  };

  const addGroup = (): void => {
    const id = randomId();
    manager.addGroup({
      layerConfig: { layerId: id, layerName: `Group ${id}`, layerType: 'layerGroup', parentId },
      visible: true,
      position: 'top',
    });
  };

  return (
    <div className={styles.controls}>
      <button type="button" className={styles.addButton} onClick={addPoint}>+ Point</button>
      <button type="button" className={styles.addButton} onClick={addArea}>+ Area</button>
      <button type="button" className={styles.addButton} onClick={addGroup}>+ Group</button>
    </div>
  );
}
