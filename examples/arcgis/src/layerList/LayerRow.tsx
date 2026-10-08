import * as React from 'react';
import { useLayer, useLayerManager } from '../layers/LayerManagerProvider';
import styles from './LayerList.module.css';
import { useLayerDragAndDrop } from './useLayerDragAndDrop';

// One layer or group: drag handle, switch, name and opacity. A group also lists its children.
function LayerRow({ layerId }: { layerId: string }): React.ReactElement | null {
  const manager = useLayerManager();
  const layer = useLayer(layerId);
  const isGroup = layer?.layerType === 'layerGroup';
  const { dropZone, handleProps, dropProps } = useLayerDragAndDrop(layerId, isGroup);
  if (!layer) {
    return null;
  }

  const row = (
    <div className={`${styles.layerItem} ${layer.visible ? styles.visible : styles.hidden} ${dropZone ? styles[`drop-${dropZone}`] : ''}`} {...dropProps}>
      <span className={styles.dragHandle} title="Drag to reorder" {...handleProps}>⠿</span>
      <label className={styles.label}>
        <input type="checkbox" checked={layer.enabled} onChange={() => manager.setEnabled(layerId, !layer.enabled)} />
        <span className={styles.labelText}>{`${isGroup ? '📁' : '📄'} ${layer.layerName} (${layer.visible ? 'visible' : 'hidden'})`}</span>
      </label>
      <div className={styles.opacityControls}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={layer.opacity}
          onChange={(event) => manager.setOpacity(layerId, Number(event.target.value))}
          className={styles.opacitySlider}
        />
        <span className={styles.opacityValue}>{`${Math.round(layer.opacity * 100)}%`}</span>
      </div>
    </div>
  );

  if (layer.layerType === 'layer') {
    return <div className={styles.treeItem}>{row}</div>;
  }

  return (
    <section className={`${styles.treeItem} ${styles.group}`}>
      {row}
      <div className={styles.groupChildren}>
        <LayerRows layerIds={layer.childIds} />
      </div>
    </section>
  );
}

// A row re-renders only when its own layer changes.
const MemoisedLayerRow = React.memo(LayerRow);

// The manager orders layers bottom first; the list shows them top first, like the map.
export function LayerRows({ layerIds }: { layerIds: readonly string[] }): React.ReactElement {
  return <>{[...layerIds].reverse().map((layerId) => <MemoisedLayerRow key={layerId} layerId={layerId} />)}</>;
}
