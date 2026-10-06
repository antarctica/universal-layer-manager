import type { LayerManager, LayerTree, ManagedLayerInfo } from '@ulm/core';
import type { LayerData } from './manager';
import * as React from 'react';

type Manager = LayerManager<LayerData>;

const LayerManagerContext = React.createContext<Manager | null>(null);

/** Makes `manager` available to the hooks below. */
export function LayerManagerProvider({ manager, children }: { manager: Manager; children: React.ReactNode }): React.ReactElement {
  return <LayerManagerContext.Provider value={manager}>{children}</LayerManagerContext.Provider>;
}

/** Returns the manager, to change layers with its methods. */
export function useLayerManager(): Manager {
  const manager = React.useContext(LayerManagerContext);
  if (!manager) {
    throw new Error('useLayerManager must be used inside a <LayerManagerProvider>.');
  }
  return manager;
}

/** Returns the layer tree, and re-renders when it changes. */
export function useLayerTree(): LayerTree<LayerData> {
  const manager = useLayerManager();
  return React.useSyncExternalStore(manager.subscribe, manager.getTree);
}

/** Returns one layer or group, and re-renders only when it changes. */
export function useLayer(layerId: string): ManagedLayerInfo<LayerData> | undefined {
  const manager = useLayerManager();
  return React.useSyncExternalStore(manager.subscribe, () => manager.getTree().layers[layerId]);
}
