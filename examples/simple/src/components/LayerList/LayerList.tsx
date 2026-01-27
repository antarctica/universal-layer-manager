import type { LayerActor, LayerMachineActor } from 'universal-layer-manager';
import type { ClientLayerGroupMachineActor } from '../../layerManager/LayerManagerProvider';

import { isLayerGroupMachine } from 'universal-layer-manager';
import { useLayerGroupChildLayers, useTopLevelLayers } from '../../layerManager/baseSelectors';
import {

  LayerManagerContext,
} from '../../layerManager/LayerManagerProvider';
import Button from '../Button/Button';
import { LayerGroupItem, LayerItem } from './LayerItems';
import styles from './LayerList.module.css';

function randomId() {
  return Math.random().toString(36).substring(7);
}

interface LayerControlsProps {
  parentId: string | null;
  indent: number;
}

function LayerControls({ parentId, indent }: LayerControlsProps) {
  const manager = LayerManagerContext.useActorRef();
  const handleAddLayer = () => {
    const id = randomId();
    manager.send({
      type: 'LAYER.ADD',
      params: {
        layerConfig: {
          layerId: id,
          layerName: `Layer ${id}`,
          layerType: 'layer',
          parentId,
          layerData: { dateCreated: new Date() },
        },
        visible: true,
      },
    });
  };

  const handleAddGroup = () => {
    const id = randomId();
    manager.send({
      type: 'LAYER.ADD',
      params: {
        layerConfig: {
          layerId: id,
          layerName: `Group ${id}`,
          layerType: 'layerGroup',
          parentId,
          layerData: { dateCreated: new Date() },
        },
        visible: true,
      },
    });
  };

  return (
    <div className={styles.controls} style={{ marginLeft: `${indent * 20}px` }}>
      <Button onPress={handleAddLayer}>+ Layer</Button>
      <Button onPress={handleAddGroup}>+ Group</Button>
    </div>
  );
}

interface LayerGroupProps {
  layerGroupActor: ClientLayerGroupMachineActor;
  indent: number;
}

function LayerGroup({ layerGroupActor, indent }: LayerGroupProps) {
  const childLayers = useLayerGroupChildLayers(layerGroupActor);

  return (
    <>
      <LayerGroupItem layerActor={layerGroupActor} indent={indent} />
      <LayerControls parentId={layerGroupActor.id} indent={indent + 1} />
      <LayerItemList layers={childLayers as LayerActor[]} indent={indent + 1} />
    </>
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

export function LayerList() {
  const topLevelLayers = useTopLevelLayers();

  return (
    <div>
      <LayerControls indent={0} parentId={null} />
      <LayerItemList layers={topLevelLayers.map((layer) => layer.layerActor)} indent={0} />
    </div>
  );
}
