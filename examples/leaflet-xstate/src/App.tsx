import * as React from 'react';
import styles from './App.module.css';
import { LayerList } from './layerList/LayerList';
import { LayerManagerContext } from './layers/LayerManagerContext';
import { addStartingLayers } from './layers/startingLayers';
import { LeafletMap } from './map/LeafletMap';

// Adds the starting layers to the provider's manager actor, and logs the changes it rejects.
function ManagerSetup(): null {
  const managerRef = LayerManagerContext.useActorRef();

  React.useEffect(() => addStartingLayers(managerRef), [managerRef]);

  React.useEffect(() => {
    const subscription = managerRef.on('LAYER.REJECTED', ({ reason }) => console.warn(reason));
    return () => subscription.unsubscribe();
  }, [managerRef]);

  return null;
}

// The layer list beside the map. Both read and change the same manager actor.
export function App(): React.ReactElement {
  return (
    <LayerManagerContext.Provider>
      <ManagerSetup />
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
    </LayerManagerContext.Provider>
  );
}
