import type { LayerTree, MoveLayerTarget } from '@ulm/core';
import type { LayerData } from '../layers/manager';
import * as React from 'react';
import { useLayerManager } from '../layers/LayerManagerProvider';

export type DropZone = 'above' | 'below' | 'into';

const DRAG_TYPE = 'application/x-ulm-layer-id';

// A group row has a middle zone for dropping into the group; a layer row only has above and below.
function getDropZone(event: React.DragEvent<HTMLElement>, isGroup: boolean): DropZone {
  const { top, height } = event.currentTarget.getBoundingClientRect();
  const y = (event.clientY - top) / height;
  if (isGroup && y >= 0.25 && y <= 0.75) {
    return 'into';
  }
  return y < 0.5 ? 'above' : 'below';
}

// Where a layer sits: its parent, and its index among that parent's children, counting from the bottom.
function getPlacement(tree: LayerTree<LayerData>, layerId: string) {
  const layer = tree.layers[layerId];
  if (!layer) {
    return null;
  }
  const parent = layer.parentId ? tree.layers[layer.parentId] : undefined;
  const siblings = parent?.layerType === 'layerGroup' ? parent.childIds : tree.rootIds;
  return { parentId: layer.parentId, index: siblings.indexOf(layerId) };
}

// The panel lists layers top first, but moveLayer counts from the bottom, and its index is
// where the layer ends up once it has left its old place.
function getMoveTarget(
  tree: LayerTree<LayerData>,
  draggedId: string,
  targetId: string,
  zone: DropZone,
): MoveLayerTarget | null {
  if (zone === 'into') {
    return { parentId: targetId, position: 'top' };
  }
  const dragged = getPlacement(tree, draggedId);
  const target = getPlacement(tree, targetId);
  if (!dragged || !target) {
    return null;
  }
  const leavesGapBelowTarget = dragged.parentId === target.parentId && dragged.index < target.index;
  const index = target.index + (zone === 'above' ? 1 : 0) - (leavesGapBelowTarget ? 1 : 0);
  return { parentId: target.parentId, index };
}

// Drag a row by its handle and drop it above, below or into another row.
export function useLayerDragAndDrop(layerId: string, isGroup: boolean) {
  const manager = useLayerManager();
  const [dropZone, setDropZone] = React.useState<DropZone | null>(null);

  const handleProps = {
    draggable: true,
    onDragStart: (event: React.DragEvent<HTMLElement>) => {
      event.dataTransfer.setData(DRAG_TYPE, layerId);
      event.dataTransfer.effectAllowed = 'move';
      const row = event.currentTarget.parentElement;
      if (row) {
        event.dataTransfer.setDragImage(row, 0, 0);
      }
    },
  };

  const dropProps = {
    onDragOver: (event: React.DragEvent<HTMLElement>) => {
      if (!event.dataTransfer.types.includes(DRAG_TYPE)) {
        return;
      }
      event.preventDefault();
      setDropZone(getDropZone(event, isGroup));
    },
    onDragLeave: (event: React.DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setDropZone(null);
      }
    },
    onDrop: (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDropZone(null);
      const draggedId = event.dataTransfer.getData(DRAG_TYPE);
      if (!draggedId || draggedId === layerId) {
        return;
      }
      const target = getMoveTarget(manager.getTree(), draggedId, layerId, getDropZone(event, isGroup));
      if (target) {
        manager.moveLayer(draggedId, target);
      }
    },
  };

  return { dropZone, handleProps, dropProps };
}
