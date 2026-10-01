import type { ClientLayerActor, ClientLayerGroupMachineActor, ClientLayerMachineActor } from '../../layerManager/LayerManagerProvider';

import { isLayerGroupMachine } from '@ulm/core';
import { useLayerGroupChildLayers, useTopLevelLayers } from '../../layerManager/baseSelectors';
import { LayerControls } from './LayerControls';
import { LayerGroupItem, LayerItem } from './LayerItems';
import styles from './LayerList.module.css';

interface LayerGroupProps {
  layerGroupActor: ClientLayerGroupMachineActor;
}

// A group's controls and children sit in a container with a guide line, so nesting reads as a tree.
function LayerGroup({ layerGroupActor }: LayerGroupProps) {
  const childLayers = useLayerGroupChildLayers(layerGroupActor);

  return (
    <section className={`${styles.treeItem} ${styles.group}`}>
      <LayerGroupItem layerActor={layerGroupActor} />
      <div className={styles.groupChildren}>
        <LayerControls parentId={layerGroupActor.id} />
        <LayerItemList layers={childLayers as ClientLayerActor[]} />
      </div>
    </section>
  );
}

interface LayerListProps {
  layers: ClientLayerActor[];
}

// The manager orders layers bottom first; the panel lists them top first, like the map.
function LayerItemList({ layers }: LayerListProps) {
  return (
    <>
      {[...layers].reverse().map((layer) =>
        isLayerGroupMachine(layer)
          ? (
              <LayerGroup
                key={layer.id}
                layerGroupActor={layer as ClientLayerGroupMachineActor}
              />
            )
          : (
              <LayerItem key={layer.id} layerActor={layer as ClientLayerMachineActor} />
            ),
      )}
    </>
  );
}

// Renders all layers as a tree with:
// - Global controls at the top
// - Optional nested groups, each with their own controls and children
export function LayerList() {
  const topLevelLayers = useTopLevelLayers();

  return (
    <div>
      <LayerControls parentId={null} />
      <LayerItemList layers={topLevelLayers.map((layer) => layer.layerActor)} />
    </div>
  );
}
