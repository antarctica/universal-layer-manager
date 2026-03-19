import type { LayerActor, LayerMachineActor } from '@ulm/core';
import type { ClientLayerGroupMachineActor } from '../../layerManager/LayerManagerProvider';

import { isLayerGroupMachine } from '@ulm/core';
import { useLayerGroupChildLayers, useTopLevelLayers } from '../../layerManager/baseSelectors';
import { LayerControls } from './LayerControls';
import { LayerGroupItem, LayerItem } from './LayerItems';

interface LayerGroupProps {
  layerGroupActor: ClientLayerGroupMachineActor;
  indent: number;
}

function LayerGroup({ layerGroupActor, indent }: LayerGroupProps) {
  const childLayers = useLayerGroupChildLayers(layerGroupActor);

  return (
    <section style={{ marginBottom: '20px', marginTop: '20px' }}>
      <LayerGroupItem layerActor={layerGroupActor} indent={indent} />
      <LayerControls parentId={layerGroupActor.id} indent={indent + 1} />
      <LayerItemList layers={childLayers as LayerActor[]} indent={indent + 1} />
    </section>
  );
}

interface LayerListProps {
  layers: LayerActor[];
  indent: number;
}

function LayerItemList({ layers, indent }: LayerListProps) {
  return (
    <>
      {layers.map((layer) =>
        isLayerGroupMachine(layer)
          ? (
              <LayerGroup
                key={layer.id}
                layerGroupActor={layer as ClientLayerGroupMachineActor}
                indent={indent}
              />
            )
          : (
              <LayerItem key={layer.id} layerActor={layer as LayerMachineActor} indent={indent} />
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
      <LayerControls indent={0} parentId={null} />
      <LayerItemList layers={topLevelLayers.map((layer) => layer.layerActor)} indent={0} />
    </div>
  );
}
