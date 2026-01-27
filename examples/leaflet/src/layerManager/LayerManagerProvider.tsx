import type * as L from 'leaflet';

import type {
  LayerGroupMachineActor,
  LayerMachineActor,
  LayerManagerActor,
} from 'universal-layer-manager';
import { createActorContext } from '@xstate/react';
import React from 'react';
import { createLayerManagerMachine } from 'universal-layer-manager';

// Extra data we store on each managed layer in this example.
// Here we only care about the concrete Leaflet layer instance.
export interface LayerData {
  leafletLayer: L.Layer;
}

export type ClientLayerManagerActor = LayerManagerActor<LayerData, undefined>;
export type ClientLayerGroupMachineActor = LayerGroupMachineActor<LayerData, undefined>;
export type ClientLayerMachineActor = LayerMachineActor<LayerData, undefined>;

// Shared XState actor context used by both the map and the layer list UI.
export const LayerManagerContext = createActorContext(
  createLayerManagerMachine<LayerData, undefined>(),
  {
    input: {
      allowNestedGroupLayers: true,
    },
  },
);

export const LayerManagerProvider = React.memo(
  ({ children }: { children: React.ReactNode }) => {
    return <LayerManagerContext.Provider>{children}</LayerManagerContext.Provider>;
  },
);
