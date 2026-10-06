import type { ClientLayerActor } from '../layers/LayerManagerContext';
import * as React from 'react';
import { useActorLayer, useChildActors } from '../layers/LayerManagerContext';
import { AddLayerButtons } from './AddLayerButtons';
import styles from './LayerList.module.css';
import { useLayerDragAndDrop } from './useLayerDragAndDrop';

// One layer or group, read from its actor and changed by sending the actor events. A group also lists its children.
function LayerRow({ actor }: { actor: ClientLayerActor }): React.ReactElement {
  const layer = useActorLayer(actor);
  const childActors = useChildActors(actor);
  const { dropZone, handleProps, dropProps } = useLayerDragAndDrop(actor.id, layer.isGroup);

  const row = (
    <div className={`${styles.layerItem} ${layer.visible ? styles.visible : styles.hidden} ${dropZone ? styles[`drop-${dropZone}`] : ''}`} {...dropProps}>
      <span className={styles.dragHandle} title="Drag to reorder" {...handleProps}>⠿</span>
      <label className={styles.label}>
        <input type="checkbox" checked={layer.enabled} onChange={() => actor.send({ type: layer.enabled ? 'LAYER.DISABLED' : 'LAYER.ENABLED' })} />
        <span className={styles.labelText}>{`${layer.isGroup ? '📁' : '📄'} ${layer.layerName} (${layer.visible ? 'visible' : 'hidden'})`}</span>
      </label>
      <div className={styles.opacityControls}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={layer.opacity}
          onChange={(event) => actor.send({ type: 'LAYER.SET_OPACITY', opacity: Number(event.target.value) })}
          className={styles.opacitySlider}
        />
        <span className={styles.opacityValue}>{`${Math.round(layer.opacity * 100)}%`}</span>
      </div>
    </div>
  );

  if (!layer.isGroup) {
    return <div className={styles.treeItem}>{row}</div>;
  }

  return (
    <section className={`${styles.treeItem} ${styles.group}`}>
      {row}
      <div className={styles.groupChildren}>
        <AddLayerButtons parentId={actor.id} />
        <LayerRows actors={childActors} />
      </div>
    </section>
  );
}

// A row re-renders only when its own actor changes.
const MemoisedLayerRow = React.memo(LayerRow);

// The manager orders layers bottom first; the list shows them top first, like the map.
export function LayerRows({ actors }: { actors: readonly ClientLayerActor[] }): React.ReactElement {
  return <>{[...actors].reverse().map((actor) => <MemoisedLayerRow key={actor.id} actor={actor} />)}</>;
}
