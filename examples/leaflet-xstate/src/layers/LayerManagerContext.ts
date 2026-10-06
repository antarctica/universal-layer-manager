import type { LayerActor, LayerManagerActor, ManagedItem } from '@ulm/core';
import type * as L from 'leaflet';
import { createLayerManagerMachine, findManagedLayerById, isLayerGroupMachine } from '@ulm/core';
import { createActorContext, useSelector } from '@xstate/react';
import * as React from 'react';

// The data each layer carries in this demo: the Leaflet layer that draws it.
export interface LayerData {
  leafletLayer: L.Layer;
}

export type ManagerRef = LayerManagerActor<LayerData, undefined>;
export type ClientLayerActor = LayerActor<LayerData>;

// The provider creates and starts the manager actor, and stops it when it unmounts.
export const LayerManagerContext = createActorContext(createLayerManagerMachine<LayerData, undefined>(), {
  input: { allowNestedGroupLayers: true },
});

const NO_CHILDREN: readonly string[] = [];

function actorsFor(layerIds: readonly string[], layers: ManagedItem<LayerData, undefined>[]): ClientLayerActor[] {
  return layerIds.flatMap((layerId) => {
    const actor = findManagedLayerById(layers, layerId)?.layerActor;
    return actor ? [actor] : [];
  });
}

/** Returns the actors of the top-level layers and groups, bottom first. */
export function useTopLevelActors(): ClientLayerActor[] {
  const order = LayerManagerContext.useSelector((state) => state.context.childLayerOrder);
  const layers = LayerManagerContext.useSelector((state) => state.context.layers);
  return React.useMemo(() => actorsFor(order, layers), [order, layers]);
}

/** Returns the actors of a group's children, bottom first, or none for a layer. */
export function useChildActors(actor: ClientLayerActor): ClientLayerActor[] {
  const childIds = useSelector(actor, (state) => ('childLayerOrder' in state.context ? state.context.childLayerOrder : NO_CHILDREN));
  const layers = LayerManagerContext.useSelector((state) => state.context.layers);
  return React.useMemo(() => actorsFor(childIds, layers), [childIds, layers]);
}

interface ActorLayer {
  layerName: string;
  isGroup: boolean;
  enabled: boolean;
  visible: boolean;
  opacity: number;
}

/** Returns what a row shows for one actor. Each value re-renders the row only when it changes. */
export function useActorLayer(actor: ClientLayerActor): ActorLayer {
  return {
    layerName: useSelector(actor, (state) => state.context.layerName),
    isGroup: isLayerGroupMachine(actor),
    enabled: useSelector(actor, (state) => state.hasTag('enabled')),
    visible: useSelector(actor, (state) => state.hasTag('visible')),
    opacity: useSelector(actor, (state) => state.context.opacity),
  };
}
