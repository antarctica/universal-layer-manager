import type { SnapshotFrom } from 'xstate';
import type { LayerTree, ManagedLayerInfo } from './adapters/types';
import type { LayerManagerActor } from './layerManagerMachines/layerManagerMachine';
import type { LayerActor, LayerManagerContext, ManagedItem } from './types';

/**
 * Returns a function that reads the layer tree of a manager actor from its XState snapshots.
 * It returns the same tree until something changes, and keeps the same info object for each layer that did not change.
 */
export function createLayerTreeReader<TLayer, TGroup>(manager: LayerManagerActor<TLayer, TGroup>): () => LayerTree<TLayer, TGroup> {
  let cache: {
    managerSnapshot: SnapshotFrom<LayerManagerActor<TLayer, TGroup>>;
    layerSnapshots: SnapshotFrom<LayerActor<TLayer, TGroup>>[];
    tree: LayerTree<TLayer, TGroup>;
  } | null = null;
  const infos = new WeakMap<SnapshotFrom<LayerActor<TLayer, TGroup>>, ManagedLayerInfo<TLayer, TGroup>>();

  function selectTree(context: LayerManagerContext<TLayer, TGroup>): LayerTree<TLayer, TGroup> {
    const layers: Record<string, ManagedLayerInfo<TLayer, TGroup>> = {};
    for (const managed of context.layers) {
      const layerSnapshot = managed.layerActor.getSnapshot();
      const info = infos.get(layerSnapshot) ?? toInfo(managed);
      infos.set(layerSnapshot, info);
      layers[info.layerId] = info;
    }
    const previous = cache?.tree;
    const rootIds = previous && sameItems(previous.rootIds, context.childLayerOrder) ? previous.rootIds : [...context.childLayerOrder];
    return { rootIds, layers };
  }

  return () => {
    const managerSnapshot = manager.getSnapshot();
    const { layers } = managerSnapshot.context;
    const previous = cache;
    // The same manager snapshot holds the same layers, so only each layer's own snapshot can differ.
    if (previous?.managerSnapshot === managerSnapshot && layers.every((managed, index) => managed.layerActor.getSnapshot() === previous.layerSnapshots[index])) {
      return previous.tree;
    }
    const tree = selectTree(managerSnapshot.context);
    cache = { managerSnapshot, layerSnapshots: layers.map((managed) => managed.layerActor.getSnapshot()), tree };
    return tree;
  };
}

/**
 * Builds one layer's or group's info from its actor's snapshot alone. The manager sets the parent ref
 * and a group's child order, so they already hold the layer's place in the tree.
 */
function toInfo<TLayer, TGroup>(managed: ManagedItem<TLayer, TGroup>): ManagedLayerInfo<TLayer, TGroup> {
  const snapshot = managed.layerActor.getSnapshot();
  const { layerId, layerName, opacity, computedOpacity, timeInfo, parentRef } = snapshot.context;
  const common = {
    layerId,
    layerName,
    opacity,
    computedOpacity,
    timeInfo,
    enabled: snapshot.hasTag('enabled'),
    visible: snapshot.hasTag('visible'),
    parentId: parentRef?.id ?? null,
  };
  if (managed.type === 'layer') {
    const { layerData, listMode } = managed.layerActor.getSnapshot().context;
    return { ...common, layerType: 'layer', layerData, listMode };
  }
  const { layerData, listMode, childLayerOrder } = managed.layerActor.getSnapshot().context;
  return { ...common, layerType: 'layerGroup', layerData, listMode, childIds: [...childLayerOrder] };
}

function sameItems(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}
