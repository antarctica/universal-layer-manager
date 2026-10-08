import * as React from 'react';
import styles from './LayerList.module.css';

// A fixed row below every layer, as the basemap draws below them all.
export function BasemapRow(): React.ReactElement {
  return (
    <div className={`${styles.layerItem} ${styles.basemap}`}>
      <span className={styles.labelText}>🗺️ Basemap: BAS Antarctica</span>
    </div>
  );
}
