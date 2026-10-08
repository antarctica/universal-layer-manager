import * as React from 'react';
import styles from './App.module.css';
import { BasemapRow } from './layerList/BasemapRow';
import { LayerList } from './layerList/LayerList';
import { LayerManagerProvider } from './layers/LayerManagerProvider';
import { manager } from './layers/manager';
import { ArcGISMap } from './map/ArcGISMap';

// The layer list beside the map. Both read and change the same manager. The basemap is the map's basemap, not a
// layer, so it sits in its own row below the list.
export function App(): React.ReactElement {
  return (
    <LayerManagerProvider manager={manager}>
      <div className={styles.page}>
        <section className={styles.panel}>
          <h1 className={styles.title}>Layer Manager</h1>
          <p className={styles.intro}>
            Sea ice, Antarctic Digital Database and Bedmap3 layers on the British Antarctic Survey basemap. Switch
            layers on and off, fade them, pick a date for the sea ice, or drag a layer by its ⠿ handle to reorder it.
          </p>
          <LayerList />
          <BasemapRow />
        </section>
        <main className={styles.map}>
          <ArcGISMap />
        </main>
      </div>
    </LayerManagerProvider>
  );
}
