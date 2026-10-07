import * as React from 'react';
import { BASEMAPS } from '../map/basemaps';
import styles from './LayerList.module.css';

interface Props {
  basemap: string;
  onBasemapChange: (basemap: string) => void;
}

// A fixed row below every layer, as the basemap draws below them all.
export function BasemapRow({ basemap, onBasemapChange }: Props): React.ReactElement {
  return (
    <label className={`${styles.layerItem} ${styles.basemap}`}>
      <span className={styles.labelText}>🗺️ Basemap</span>
      <select className={styles.basemapSelect} value={basemap} onChange={(event) => onBasemapChange(event.target.value)}>
        {BASEMAPS.map(({ name, url }) => <option key={url} value={url}>{name}</option>)}
      </select>
    </label>
  );
}
