import * as React from 'react';
import styles from './App.module.css';
import { BasemapRow } from './layerList/BasemapRow';
import { LayerList } from './layerList/LayerList';
import { LayerManagerProvider } from './layers/LayerManagerProvider';
import { manager } from './layers/manager';
import { BASEMAPS } from './map/basemaps';
import { MapLibreMap } from './map/MapLibreMap';

// The layer list beside the map. Both read and change the same manager. The basemap is the map's style, not a layer,
// so it sits in its own row below the list.
export function App(): React.ReactElement {
  const [basemap, setBasemap] = React.useState(BASEMAPS[0].url);

  return (
    <LayerManagerProvider manager={manager}>
      <div className={styles.page}>
        <section className={styles.panel}>
          <h1 className={styles.title}>Layer Manager</h1>
          <p className={styles.intro}>
            Raster and vector tile layers, drawn below the basemap&apos;s labels. Switch layers on and off, fade them, add a
            point or a 5 km area, drag a layer by its ⠿ handle to reorder it, or switch the basemap. Zoom in for the 3D
            buildings.
          </p>
          <LayerList />
          <BasemapRow basemap={basemap} onBasemapChange={setBasemap} />
        </section>
        <main className={styles.map}>
          <MapLibreMap basemap={basemap} />
        </main>
      </div>
    </LayerManagerProvider>
  );
}
