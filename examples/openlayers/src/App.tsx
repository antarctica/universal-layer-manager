import * as React from 'react';
import styles from './App.module.css';
import { BasemapRow } from './layerList/BasemapRow';
import { LayerList } from './layerList/LayerList';
import { LayerManagerProvider } from './layers/LayerManagerProvider';
import { manager } from './layers/manager';
import { BASEMAPS } from './map/basemaps';
import { OpenLayersMap } from './map/OpenLayersMap';

// The layer list beside the map. Both read and change the same manager. The basemap is two layers of the app's own,
// not managed layers, so it sits in its own row below the list.
export function App(): React.ReactElement {
  const [basemapName, setBasemapName] = React.useState(BASEMAPS[0].name);
  const basemap = BASEMAPS.find(({ name }) => name === basemapName) ?? BASEMAPS[0];

  return (
    <LayerManagerProvider manager={manager}>
      <div className={styles.page}>
        <section className={styles.panel}>
          <h1 className={styles.title}>Layer Manager</h1>
          <p className={styles.intro}>
            Raster and vector tile layers, drawn between the basemap and its labels. Switch layers on and off, fade them,
            add a point or a 5 km area, drag a layer by its ⠿ handle to reorder it, or switch the basemap. Zoom in for
            the buildings.
          </p>
          <LayerList />
          <BasemapRow basemap={basemapName} onBasemapChange={setBasemapName} />
        </section>
        <main className={styles.map}>
          <OpenLayersMap basemap={basemap} />
        </main>
      </div>
    </LayerManagerProvider>
  );
}
