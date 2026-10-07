import type { LayerManagerAdapter, LayerManagerHooks, LayerTree, ManagedLayerInfo } from './adapters/types';
import type { LayerManagerActor } from './layerManagerMachines/layerManagerMachine';
import { createLayerTreeReader } from './layerTree';

/**
 * Attaches `adapter` to a manager actor: tells it about the layers the manager already holds,
 * then reports every change. Returns a function that disconnects it again.
 * @experimental
 */
export function connectAdapter<TLayer, TGroup>(
  manager: LayerManagerActor<TLayer, TGroup>,
  adapter: LayerManagerAdapter<TLayer, TGroup>,
): () => void {
  const getTree = createLayerTreeReader(manager);
  adapter.register?.();
  const tree = getTree();
  const layerOrder = flattenIds(tree.rootIds, tree.layers);
  for (const layerId of layerOrder) {
    const info = tree.layers[layerId];
    if (info) {
      adapter.onLayerAdded?.(info);
    }
  }
  adapter.onOrderChanged?.(layerOrder);

  const disconnectHooks = connectHooks(manager, adapter, getTree);
  return () => {
    disconnectHooks();
    adapter.unregister?.();
  };
}

/** Calls `hooks` for each change the manager reports. Returns a function that disconnects them. */
export function connectHooks<TLayer, TGroup>(
  manager: LayerManagerActor<TLayer, TGroup>,
  hooks: LayerManagerHooks<TLayer, TGroup>,
  getTree: () => LayerTree<TLayer, TGroup>,
): () => void {
  const withInfo = (layerId: string, call: (info: ManagedLayerInfo<TLayer, TGroup>) => void): void => {
    const info = getTree().layers[layerId];
    if (info) {
      call(info);
    }
  };

  const subscriptions = [
    manager.on('LAYER.ADDED', ({ layerId }) => withInfo(layerId, (info) => hooks.onLayerAdded?.(info))),
    manager.on('LAYER.REMOVED', ({ layerId }) => hooks.onLayerRemoved?.(layerId)),
    manager.on('LAYER.VISIBILITY_CHANGED', ({ layerId, visible }) => withInfo(layerId, (info) => hooks.onVisibilityChanged?.(info, visible))),
    manager.on('LAYER.ENABLED_CHANGED', ({ layerId, enabled }) => withInfo(layerId, (info) => hooks.onEnabledChanged?.(info, enabled))),
    manager.on('LAYER.OPACITY_CHANGED', ({ layerId, computedOpacity }) => withInfo(layerId, (info) => hooks.onOpacityChanged?.(info, computedOpacity))),
    manager.on('LAYER.TIME_INFO_CHANGED', ({ layerId, timeInfo }) => withInfo(layerId, (info) => hooks.onTimeInfoChanged?.(info, timeInfo))),
    manager.on('LAYER.LAYER_DATA_CHANGED', ({ layerId }) => withInfo(layerId, (info) => hooks.onLayerDataChanged?.(info))),
    manager.on('LAYER.ORDER_CHANGED', ({ layerOrder }) => hooks.onOrderChanged?.(layerOrder)),
    manager.on('LAYER.MOVED', ({ layerId }) => withInfo(layerId, (info) => hooks.onLayerMoved?.(info))),
  ];
  return () => subscriptions.forEach((subscription) => subscription.unsubscribe());
}

/** Every ID from the given ones down, each group followed by its children, bottom first. */
function flattenIds<TLayer, TGroup>(ids: readonly string[], layers: LayerTree<TLayer, TGroup>['layers']): string[] {
  return ids.flatMap((id) => {
    const info = layers[id];
    return [id, ...(info?.layerType === 'layerGroup' ? flattenIds(info.childIds, layers) : [])];
  });
}
