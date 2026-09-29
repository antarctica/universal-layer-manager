import type { ActorRefFrom } from 'xstate';

import type {
  AddManagedLayerParams,
  LayerManagerContext,
  LayerManagerEmittedEvent,
  LayerManagerEvent,
  LayerStartState,
  ManagedItem,
} from '../types';
import { emit, enqueueActions, setup } from 'xstate';
import { layerGroupMachine } from '../layerMachines/layerGroupMachine';
import { layerMachine } from '../layerMachines/layerMachine';
import {
  canRemoveLayer,
  cleanupLayerReferences,
  findManagedLayerById,
  findParentActor,
  getFlatLayerOrder,
  getUpdatedLayerStructure,
  getUpdatedLayerStructureAfterRemoval,
  isValidLayerConfig,
  isValidParentRef,
} from '../utils';

export type LayerManagerMachine<TLayer, TGroup = TLayer> = ReturnType<typeof createLayerManagerMachine<TLayer, TGroup>>;
export type LayerManagerActor<TLayer, TGroup = TLayer> = ActorRefFrom<LayerManagerMachine<TLayer, TGroup>>;

export function createLayerManagerMachine<TLayer, TGroup = TLayer>() {
  return setup({
    types: {
      context: {} as LayerManagerContext<TLayer, TGroup>,
      events: {} as LayerManagerEvent<TLayer, TGroup>,
      emitted: {} as LayerManagerEmittedEvent<TLayer, TGroup>,
      input: {} as {
        allowNestedGroupLayers: boolean;
      },
    },
    actors: {
      layerMachine: layerMachine<TLayer, TGroup>(),
      layerGroupMachine: layerGroupMachine<TLayer, TGroup>(),
    },
    actions: {
      'Add new layer': enqueueActions(({ enqueue, context, self }, params: AddManagedLayerParams<TLayer, TGroup>) => {
        const { layerConfig, index, visible, enabled, position } = params;

        const parentRef = findParentActor(context.layers, layerConfig);
        if (!isValidParentRef(layerConfig, parentRef)) {
          return;
        }

        function getStartState(enabled: boolean, visible: boolean): LayerStartState {
          if (visible || (enabled && (!parentRef || parentRef.getSnapshot().hasTag('visible')))) {
            return 'enabled.visible';
          }
          if (enabled) {
            return 'enabled.hidden';
          }
          return 'disabled';
        }

        enqueue.assign(({ spawn }) => {
          let newManagedLayer: ManagedItem<TLayer, TGroup>;
          if (layerConfig.layerType === 'layerGroup') {
            const newLayer = spawn('layerGroupMachine', {
              id: layerConfig.layerId,
              input: {
                layerManagerRef: self,
                parentRef,
                ...layerConfig,
                startState: getStartState(enabled ?? false, visible ?? false),
              },
            });
            newManagedLayer = {
              type: 'layerGroup',
              layerActor: newLayer,
            };
          } else {
            const newLayer = spawn('layerMachine', {
              id: layerConfig.layerId,
              input: {
                layerManagerRef: self,
                parentRef,
                ...layerConfig,
                startState: getStartState(enabled ?? false, visible ?? false),
              },
            });
            newManagedLayer = {
              type: 'layer',
              layerActor: newLayer,
            };
          }

          return getUpdatedLayerStructure(context, newManagedLayer, parentRef, index, position);
        });

        enqueue.emit(({ context }) => ({
          type: 'LAYER.ADDED' as const,
          layerId: layerConfig.layerId,
          visible: findManagedLayerById(context.layers, layerConfig.layerId)?.layerActor.getSnapshot().hasTag('visible') ?? false,
        }));
      }),

      'Remove layer': enqueueActions(({ enqueue, context }, params: { layerId: string }) => {
        const { layerId } = params;

        const layerToRemove = findManagedLayerById(context.layers, layerId);

        if (!layerToRemove || !canRemoveLayer(layerToRemove)) {
          return;
        }
        cleanupLayerReferences(layerToRemove);
        enqueue.stopChild(layerId);
        enqueue.assign(() => {
          return getUpdatedLayerStructureAfterRemoval(context, layerId);
        });
        enqueue.emit({ type: 'LAYER.REMOVED', layerId });
      }),

      'Emit update layer order': emit(({ context }) => ({
        type: 'LAYER.ORDER_CHANGED' as const,
        layerOrder: getFlatLayerOrder(context.layers, context.childLayerOrder),
      })),

      // Reset actions
      'Reset layer manager': enqueueActions(({ enqueue, context }) => {
        context.layers.forEach((layer) => {
          enqueue.stopChild(layer.layerActor);
          enqueue.emit({ type: 'LAYER.REMOVED', layerId: layer.layerActor.id });
        });
        enqueue.assign({
          layers: [],
          childLayerOrder: [],
        });
      }),
    },
    guards: {
      isValidLayerConfig: ({ context }, params: AddManagedLayerParams<TLayer, TGroup>) => isValidLayerConfig(params.layerConfig, context),
    },
  }).createMachine({
    id: 'layerManager',
    context: ({ input }) => ({
      layers: [],
      childLayerOrder: [],
      allowNestedGroupLayers: input.allowNestedGroupLayers,
    }),
    on: {
      'LAYER.UPDATE_VISIBILITY': {
        actions: emit(({ event }) => ({
          type: 'LAYER.VISIBILITY_CHANGED',
          layerId: event.layerId,
          visible: event.visible,
        })),
      },
      'LAYER.UPDATE_OPACITY': {
        actions: [
          emit(({ event }) => ({
            type: 'LAYER.OPACITY_CHANGED',
            layerId: event.layerId,
            opacity: event.opacity,
            computedOpacity: event.computedOpacity,
          })),
        ],
      },
      'LAYER.UPDATE_TIME_INFO': {
        actions: emit(({ event }) => {
          return {
            type: 'LAYER.TIME_INFO_CHANGED',
            layerId: event.layerId,
            timeInfo: event.timeInfo,
          };
        }),
      },
      'LAYER.UPDATE_LAYER_DATA': {
        actions: emit(({ event }) => ({
          type: 'LAYER.LAYER_DATA_CHANGED',
          layerId: event.layerId,
          layerData: event.layerData,
        })),
      },
      'LAYER.ADD': {
        guard: {
          type: 'isValidLayerConfig',
          params: ({ event }) => event.params,
        },
        actions: [
          {
            type: 'Add new layer',
            params: ({ event }) => event.params,
          },
          {
            type: 'Emit update layer order',
          },
        ],
      },
      'LAYER.REMOVE': {
        actions: [
          {
            type: 'Remove layer',
            params: ({ event }) => event,
          },
          {
            type: 'Emit update layer order',
          },
        ],
      },

      'RESET': {
        actions: ['Reset layer manager'],
      },
    },
  });
}
