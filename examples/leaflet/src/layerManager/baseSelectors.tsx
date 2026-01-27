import type { LayerGroupMachineActor, LayerMachineActor } from 'universal-layer-manager';
import { useSelector } from '@xstate/react';

import React, { useEffect, useState } from 'react';
import { getLayerGroupChildrenInOrder, getTopLevelLayersInOrder } from 'universal-layer-manager';
import { LayerManagerContext } from './LayerManagerProvider';

export function useLayerById(layerId: string) {
  const layer = LayerManagerContext.useSelector(({ context }) => {
    return context.layers.find((layer) => layer.layerActor.id === layerId);
  });

  return layer;
}

export function useTopLevelLayers() {
  const { childLayerOrder, layers } = LayerManagerContext.useSelector(({ context }) => ({
    childLayerOrder: context.childLayerOrder,
    layers: context.layers,
  }));

  const topLevelLayers = React.useMemo(
    () => getTopLevelLayersInOrder(childLayerOrder, layers),
    [childLayerOrder, layers],
  );

  return topLevelLayers;
}

export function useLayerGroupChildLayers<T>(actor: LayerGroupMachineActor<T>) {
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

export function useEnabledChildCount(children: LayerMachineActor[] | undefined) {
  const [enabledChildCount, setEnabledChildCount] = useState(0);

  useEffect(() => {
    if (!children) {
      setEnabledChildCount(0);
      return;
    }
    // If no children, set count to 0 and don't create subscriptions
    if (children.length === 0) {
      setEnabledChildCount(0);
      return;
    }

    function countEnabledChildren() {
      return children?.filter((child) => child.getSnapshot().matches('enabled')).length ?? 0;
    }

    setEnabledChildCount(countEnabledChildren());

    const subscriptions = children.map((child) =>
      child.subscribe(() => {
        setEnabledChildCount(countEnabledChildren());
      }),
    );

    return () => {
      subscriptions.forEach(({ unsubscribe }) => unsubscribe());
    };
  }, [children]);
  return enabledChildCount;
}

export interface LayerVisibility {
  id: string;
  parentId?: string | null;
}

export function useVisibleLayerIds() {
  const [visibleLayers, setVisibleLayers] = useState<LayerVisibility[]>([]);

  const actorRef = LayerManagerContext.useActorRef();

  useEffect(() => {
    const updateVisibleLayers = () => {
      const snapshot = actorRef.getSnapshot();
      const newVisibleLayers: LayerVisibility[] = [];

      // Helper function to check if a layer actor is visible
      const isLayerVisible = (actor: LayerMachineActor | LayerGroupMachineActor) => {
        const snapshot = actor.getSnapshot();
        return snapshot.matches({ enabled: 'visible' });
      };

      // Process each layer
      snapshot.context.layers.forEach((layer) => {
        const layerActor = layer.layerActor;
        const snapshot = layerActor.getSnapshot();

        if (isLayerVisible(layerActor)) {
          // Add the layer with its parent information
          newVisibleLayers.push({
            id: layerActor.id,
            ...(snapshot.context.parentRef?.id && {
              parentId: snapshot.context.parentRef?.id,
            }),
          });
        }
      });

      setVisibleLayers(newVisibleLayers);
    };

    // Initial update
    updateVisibleLayers();

    // Listen for events that affect visible layers
    const visibilitySubscription = actorRef.on('LAYER.VISIBILITY_CHANGED', () => {
      updateVisibleLayers();
    });

    const addedSubscription = actorRef.on('LAYER.ADDED', () => {
      updateVisibleLayers();
    });

    const removedSubscription = actorRef.on('LAYER.REMOVED', () => {
      updateVisibleLayers();
    });

    return () => {
      visibilitySubscription.unsubscribe();
      addedSubscription.unsubscribe();
      removedSubscription.unsubscribe();
    };
  }, [actorRef]);

  return visibleLayers;
}
