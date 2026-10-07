import * as React from 'react';
import styles from './App.module.css';
import { LayerList } from './layerList/LayerList';
import { LayerManagerProvider } from './layers/LayerManagerProvider';
import { manager } from './layers/manager';
import { LeafletMap } from './map/LeafletMap';

// The layer list beside the map. Both read and change the same manager.
export function App(): React.ReactElement {
  return (
    <LayerManagerProvider manager={manager}>
      <div className={styles.page}>
        <section className={styles.panel}>
          <h1 className={styles.title}>Layer Manager</h1>
          <p className={styles.intro}>
            Use the controls below to add markers or groups, and to toggle visibility or opacity. Drag a
            layer by its ⠿ handle to reorder it, or drop it on the middle of a group to move it in.
          </p>
          <LayerList />
        </section>
        <main className={styles.map}>
          <LeafletMap />
        </main>
      </div>
    </LayerManagerProvider>
  );
}
