import type {
  LayerGroupMachineActor, LayerMachineActor, LayerManagerActor } from 'universal-layer-manager';

import { createActorContext } from '@xstate/react';
import React from 'react';
import {
  createLayerManagerMachine,
} from 'universal-layer-manager';

export interface LayerData {
  dateCreated: Date;
}

export type ClientLayerManagerActor = LayerManagerActor<LayerData>;
export type ClientLayerGroupMachineActor = LayerGroupMachineActor<LayerData>;
export type ClientLayerMachineActor = LayerMachineActor<LayerData>;

export const LayerManagerContext = createActorContext(createLayerManagerMachine<LayerData>(), {
  input: {
    allowNestedGroupLayers: true,
  },
});

export const LayerManagerProvider = React.memo(({ children }: { children: React.ReactNode }) => {
  return <LayerManagerContext.Provider>{children}</LayerManagerContext.Provider>;
});
