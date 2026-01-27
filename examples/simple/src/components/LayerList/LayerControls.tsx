import { LayerManagerContext } from '../../layerManager/LayerManagerProvider';
import Button from '../Button/Button';
import styles from './LayerList.module.css';

function randomId() {
  return Math.random().toString(36).substring(7);
}

interface LayerControlsProps {
  parentId: string | null;
  indent: number;
}

export function LayerControls({ parentId, indent }: LayerControlsProps) {
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
