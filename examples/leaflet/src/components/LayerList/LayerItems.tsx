import type { ClientLayerGroupMachineActor, ClientLayerMachineActor } from '../../layerManager/LayerManagerProvider';
import { useSelector } from '@xstate/react';
import * as React from 'react';
import styles from './LayerList.module.css';

interface BaseLayerItemProps {
  isGroup: boolean;
  indent: number;
  isEnabled: boolean;
  isVisible: boolean;
  layerName: string;
  opacity: number;
  onToggle: () => void;
  onOpacityChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function BaseLayerItem({
  isGroup,
  indent,
  isEnabled,
  isVisible,
  layerName,
  opacity,
  onToggle,
  onOpacityChange,
}: BaseLayerItemProps) {
  const icon = isGroup ? '📁' : '📄';

  return (
    <div style={{ marginLeft: `${indent * 20}px`, marginBottom: '5px' }}>
      <div className={`${styles.layerItem} ${isVisible ? styles.visible : styles.hidden}`}>
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
  indent: number;
}

export function LayerItem({ layerActor, indent }: SingleLayerItemProps) {
  const isEnabled = useSelector(layerActor, (state) => state.matches('enabled'));
  const isVisible = useSelector(layerActor, (state) => state.matches({ enabled: 'visible' }));
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
      isGroup={false}
      indent={indent}
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
  indent: number;
}

export function LayerGroupItem({ layerActor, indent }: LayerGroupItemProps) {
  const isEnabled = useSelector(layerActor, (state) => state.matches('enabled'));
  const isVisible = useSelector(layerActor, (state) => state.matches({ enabled: 'visible' }));
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
      isGroup
      indent={indent}
      isEnabled={isEnabled}
      isVisible={isVisible}
      layerName={layerName}
      opacity={opacity}
      onToggle={handleToggle}
      onOpacityChange={handleOpacityChange}
    />
  );
}
