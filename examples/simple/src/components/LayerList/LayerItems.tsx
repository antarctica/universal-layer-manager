import type { ClientLayerGroupMachineActor, ClientLayerMachineActor } from '../../layerManager/LayerManagerProvider';
import { useSelector } from '@xstate/react';
import styles from './LayerList.module.css';

interface SingleLayerItemProps {
  layerActor: ClientLayerMachineActor;
  indent: number;
}

export function LayerItem({ layerActor, indent }: SingleLayerItemProps) {
  const isEnabled = useSelector(layerActor, (state) => state.matches('enabled'));
  const isVisible = useSelector(layerActor, (state) => state.matches({ enabled: 'visible' }));
  const layerName = useSelector(layerActor, (state) => state.context.layerName);
  const opacity = useSelector(layerActor, (state) => state.context.opacity);
  const computedOpacity = useSelector(layerActor, (state) => state.context.computedOpacity);

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
    <div
      style={{
        'marginLeft': `${indent * 20}px`,
        'marginBottom': '5px',
        '--opacity': opacity.toString(),
        '--parent-opacity': computedOpacity.toString(),
      } as React.CSSProperties}
    >
      <div
        className={`${styles.layerItem} ${isVisible ? styles.visible : styles.hidden}`}
      >
        <label className={styles.label}>
          <input type="checkbox" checked={isEnabled} onChange={handleToggle} />
          <span className={styles.labelText}>
            {`📄 ${layerName} (${isVisible ? 'visible' : 'hidden'})`}
          </span>
        </label>
        <div className={styles.opacityControls}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={opacity}
            onChange={handleOpacityChange}
            className={styles.opacitySlider}
          />
          <span className={styles.opacityValue}>
            {`${Math.round(opacity * 100)}%`}
          </span>
        </div>
      </div>
    </div>
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
  const computedOpacity = useSelector(layerActor, (state) => state.context.computedOpacity);

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
    <div
      style={{
        'marginLeft': `${indent * 20}px`,
        'marginBottom': '5px',
        '--opacity': opacity.toString(),
        '--parent-opacity': computedOpacity.toString(),
      } as React.CSSProperties}
    >
      <div
        className={`${styles.layerItem} ${isVisible ? styles.visible : styles.hidden}`}
      >
        <label className={styles.label}>
          <input type="checkbox" checked={isEnabled} onChange={handleToggle} />
          <span className={styles.labelText}>
            {`📁 ${layerName} (${isVisible ? 'visible' : 'hidden'})`}
          </span>
        </label>
        <div className={styles.opacityControls}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={opacity}
            onChange={handleOpacityChange}
            className={styles.opacitySlider}
          />
          <span className={styles.opacityValue}>
            {`${Math.round(opacity * 100)}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
