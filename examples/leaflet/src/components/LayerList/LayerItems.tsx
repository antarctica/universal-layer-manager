import type { ClientLayerGroupMachineActor, ClientLayerMachineActor } from '../../layerManager/LayerManagerProvider';
import { useSelector } from '@xstate/react';
import * as React from 'react';
import styles from './LayerList.module.css';
import { useLayerDragAndDrop } from './useLayerDragAndDrop';

interface BaseLayerItemProps {
  layerId: string;
  isGroup: boolean;
  isEnabled: boolean;
  isVisible: boolean;
  layerName: string;
  opacity: number;
  onToggle: () => void;
  onOpacityChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function BaseLayerItem({
  layerId,
  isGroup,
  isEnabled,
  isVisible,
  layerName,
  opacity,
  onToggle,
  onOpacityChange,
}: BaseLayerItemProps) {
  const icon = isGroup ? '📁' : '📄';
  const { dropZone, handleProps, dropProps } = useLayerDragAndDrop(layerId, isGroup);
  const dropZoneClass = dropZone ? styles[`drop-${dropZone}`] : '';

  return (
    <div className={isGroup ? undefined : styles.treeItem}>
      <div className={`${styles.layerItem} ${isVisible ? styles.visible : styles.hidden} ${dropZoneClass}`} {...dropProps}>
        <span className={styles.dragHandle} title="Drag to reorder" {...handleProps}>⠿</span>
        <label className={styles.label}>
          <input type="checkbox" checked={isEnabled} onChange={onToggle} />
          <span className={styles.labelText}>
            {icon}
            {' '}
            {layerName}
            {' '}
            (
            {isVisible ? 'visible' : 'hidden'}
            )
          </span>
        </label>
        <div className={styles.opacityControls}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={opacity}
            onChange={onOpacityChange}
            className={styles.opacitySlider}
          />
          <span className={styles.opacityValue}>
            {Math.round(opacity * 100)}
            %
          </span>
        </div>
      </div>
    </div>
  );
}

interface SingleLayerItemProps {
  layerActor: ClientLayerMachineActor;
}

export function LayerItem({ layerActor }: SingleLayerItemProps) {
  const isEnabled = useSelector(layerActor, (state) => state.hasTag('enabled'));
  const isVisible = useSelector(layerActor, (state) => state.hasTag('visible'));
  const layerName = useSelector(layerActor, (state) => state.context.layerName);
  const opacity = useSelector(layerActor, (state) => state.context.opacity);

  const handleToggle = () => {
    layerActor.send({ type: isEnabled ? 'LAYER.DISABLED' : 'LAYER.ENABLED' });
  };

  const handleOpacityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = Number.parseFloat(event.target.value);
    layerActor.send({
      type: 'LAYER.SET_OPACITY',
      opacity: newOpacity,
    });
  };

  return (
    <BaseLayerItem
      layerId={layerActor.id}
      isGroup={false}
      isEnabled={isEnabled}
      isVisible={isVisible}
      layerName={layerName}
      opacity={opacity}
      onToggle={handleToggle}
      onOpacityChange={handleOpacityChange}
    />
  );
}

interface LayerGroupItemProps {
  layerActor: ClientLayerGroupMachineActor;
}

export function LayerGroupItem({ layerActor }: LayerGroupItemProps) {
  const isEnabled = useSelector(layerActor, (state) => state.hasTag('enabled'));
  const isVisible = useSelector(layerActor, (state) => state.hasTag('visible'));
  const layerName = useSelector(layerActor, (state) => state.context.layerName);
  const opacity = useSelector(layerActor, (state) => state.context.opacity);

  const handleToggle = () => {
    layerActor.send({ type: isEnabled ? 'LAYER.DISABLED' : 'LAYER.ENABLED' });
  };

  const handleOpacityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = Number.parseFloat(event.target.value);
    layerActor.send({
      type: 'LAYER.SET_OPACITY',
      opacity: newOpacity,
    });
  };

  return (
    <BaseLayerItem
      layerId={layerActor.id}
      isGroup
      isEnabled={isEnabled}
      isVisible={isVisible}
      layerName={layerName}
      opacity={opacity}
      onToggle={handleToggle}
      onOpacityChange={handleOpacityChange}
    />
  );
}
