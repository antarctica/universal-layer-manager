import type { LayerGroupMachineActor } from '@ulm/core';
import { getLayerGroupChildrenInOrder, getTopLevelLayersInOrder } from '@ulm/core';

import { useSelector } from '@xstate/react';
import * as React from 'react';
import { useLayerManager } from './LayerManagerProvider';

export function useTopLevelLayers() {
  const manager = useLayerManager();
  const { childLayerOrder, layers } = useSelector(manager.actor, ({ context }) => ({
    childLayerOrder: context.childLayerOrder,
    layers: context.layers,
  }));

  const topLevelLayers = React.useMemo(
    () => getTopLevelLayersInOrder(childLayerOrder, layers),
    [childLayerOrder, layers],
  );

  return topLevelLayers;
}

export function useLayerGroupChildLayers<TLayer, TGroup>(actor: LayerGroupMachineActor<TLayer, TGroup>) {
  const { childLayerOrder, children } = useSelector(actor, ({ context }) => ({
    childLayerOrder: context.childLayerOrder,
    children: context.children,
  }));

  const layers = React.useMemo(
    () => getLayerGroupChildrenInOrder(childLayerOrder, children),
    [childLayerOrder, children],
  );

  return layers;
}
