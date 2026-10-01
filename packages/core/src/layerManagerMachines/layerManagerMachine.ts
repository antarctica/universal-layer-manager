import type { ActorRefFrom } from 'xstate';

import type {
  AddManagedLayerParams,
  LayerManagerChildEvent,
  LayerManagerContext,
  LayerManagerEmittedEvent,
  LayerManagerEvent,
  LayerStartState,
  ManagedItem,
  MoveLayerParams,
} from '../types';
import { emit, enqueueActions, setup } from 'xstate';
import { layerGroupMachine } from '../layerMachines/layerGroupMachine';
import { layerMachine } from '../layerMachines/layerMachine';
import {
  findManagedLayerById,
  findParentActor,
  findParentGroupId,
  findParentLayerGroupActor,
  getAddLayerRejection,
  getFlatLayerOrder,
  getGroupChildrenChangedEvent,
  getMoveLayerRejection,
  getRemoveLayerRejection,
  getUpdatedLayerStructure,
  getUpdatedLayerStructureAfterMove,
  getUpdatedLayerStructureAfterRemoval,
} from '../utils';

export type LayerManagerMachine<TLayer, TGroup = TLayer> = ReturnType<typeof createLayerManagerMachine<TLayer, TGroup>>;
export type LayerManagerActor<TLayer, TGroup = TLayer> = ActorRefFrom<LayerManagerMachine<TLayer, TGroup>>;

export function createLayerManagerMachine<TLayer, TGroup = TLayer>() {
  return setup({
    types: {
      context: {} as LayerManagerContext<TLayer, TGroup>,
      events: {} as LayerManagerEvent<TLayer, TGroup> | LayerManagerChildEvent<TLayer, TGroup>,
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
        const parentOpacity = parentRef?.getSnapshot().context.computedOpacity ?? 1;

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
                parentOpacity,
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
                parentOpacity,
              },
            });
            newManagedLayer = {
              type: 'layer',
              layerActor: newLayer,
            };
          }

          return getUpdatedLayerStructure(context, newManagedLayer, parentRef, index, position);
        });

        if (parentRef) {
          enqueue.sendTo(parentRef, ({ context }) => getGroupChildrenChangedEvent(context, parentRef.id));
        }

        enqueue.emit(({ context }) => ({
          type: 'LAYER.ADDED' as const,
          layerId: layerConfig.layerId,
          visible: findManagedLayerById(context.layers, layerConfig.layerId)?.layerActor.getSnapshot().hasTag('visible') ?? false,
        }));
      }),

      'Remove layer': enqueueActions(({ enqueue, context }, params: { layerId: string }) => {
        const { layerId } = params;

        const parentGroupId = findParentGroupId(context, layerId);
        const parentRef = parentGroupId ? findParentLayerGroupActor(context.layers, parentGroupId) : null;
        enqueue.stopChild(layerId);
        enqueue.assign(() => {
          return getUpdatedLayerStructureAfterRemoval(context, layerId);
        });
        if (parentRef) {
          enqueue.sendTo(parentRef, ({ context }) => getGroupChildrenChangedEvent(context, parentRef.id));
        }
        enqueue.emit({ type: 'LAYER.REMOVED', layerId });
      }),

      'Move layer': enqueueActions(({ enqueue, context }, params: MoveLayerParams) => {
        const newParentRef = params.parentId ? findParentLayerGroupActor(context.layers, params.parentId) : null;

        enqueue.assign(({ context }) => getUpdatedLayerStructureAfterMove(context, params));

        if (newParentRef) {
          enqueue.sendTo(newParentRef, ({ context }) => getGroupChildrenChangedEvent(context, newParentRef.id));
        }
      }),

      'Emit layer rejected': emit((_, params: { layerId: string; reason: string }) => ({
        type: 'LAYER.REJECTED' as const,
        layerId: params.layerId,
        reason: params.reason,
      })),

      'Emit update layer order': emit(({ context }) => ({
        type: 'LAYER.ORDER_CHANGED' as const,
        layerOrder: getFlatLayerOrder(context),
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
          groupChildLayerOrder: {},
        });
      }),
    },
    guards: {
      canAddLayer: ({ context }, params: AddManagedLayerParams<TLayer, TGroup>) => getAddLayerRejection(params.layerConfig, context) === undefined,
      canRemoveLayer: ({ context }, params: { layerId: string }) => getRemoveLayerRejection(params.layerId, context) === undefined,
      canMoveLayer: ({ context }, params: MoveLayerParams) => getMoveLayerRejection(context, params) === undefined,
      isManagedLayer: ({ context }, params: { layerId: string }) => findManagedLayerById(context.layers, params.layerId) !== undefined,
    },
  }).createMachine({
    id: 'layerManager',
    description: 'Owns the layer tree and its order, spawns layer and group actors, and reports their changes',
    context: ({ input }) => ({
      layers: [],
      childLayerOrder: [],
      groupChildLayerOrder: {},
      allowNestedGroupLayers: input.allowNestedGroupLayers,
    }),
    on: {
      'CHILD.VISIBILITY_CHANGED': {
        guard: { type: 'isManagedLayer', params: ({ event }) => ({ layerId: event.layerId }) },
        description: 'A layer or group started or stopped showing: report it, if the manager holds that layer',
        actions: emit(({ event }) => ({
          type: 'LAYER.VISIBILITY_CHANGED',
          layerId: event.layerId,
          visible: event.visible,
        })),
      },
      'CHILD.OPACITY_CHANGED': {
        guard: { type: 'isManagedLayer', params: ({ event }) => ({ layerId: event.layerId }) },
        description: 'A layer or group changed opacity: report it, if the manager holds that layer',
        actions: [
          emit(({ event }) => ({
            type: 'LAYER.OPACITY_CHANGED',
            layerId: event.layerId,
            opacity: event.opacity,
            computedOpacity: event.computedOpacity,
          })),
        ],
      },
      'CHILD.TIME_INFO_CHANGED': {
        guard: { type: 'isManagedLayer', params: ({ event }) => ({ layerId: event.layerId }) },
        description: 'A layer or group changed time info: report it, if the manager holds that layer',
        actions: emit(({ event }) => {
          return {
            type: 'LAYER.TIME_INFO_CHANGED',
            layerId: event.layerId,
            timeInfo: event.timeInfo,
          };
        }),
      },
      'CHILD.LAYER_DATA_CHANGED': {
        guard: { type: 'isManagedLayer', params: ({ event }) => ({ layerId: event.layerId }) },
        description: 'A layer or group changed data: report it, if the manager holds that layer',
        actions: emit(({ event }) => ({
          type: 'LAYER.LAYER_DATA_CHANGED',
          layerId: event.layerId,
          layerData: event.layerData,
        })),
      },
      'LAYER.ADD': [
        {
          guard: {
            type: 'canAddLayer',
            params: ({ event }) => event.params,
          },
          description: 'Spawn the layer or group, place it in its parent\'s order and report the new order',
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
        {
          description: 'Reject a duplicate ID, a missing parent group or a disallowed nested group',
          actions: {
            type: 'Emit layer rejected',
            params: ({ context, event }) => ({
              layerId: event.params.layerConfig.layerId,
              reason: getAddLayerRejection(event.params.layerConfig, context) ?? '',
            }),
          },
        },
      ],
      'LAYER.REMOVE': [
        {
          guard: {
            type: 'canRemoveLayer',
            params: ({ event }) => ({ layerId: event.layerId }),
          },
          description: 'Stop the layer or empty group, take it out of the order and report the new order',
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
        {
          description: 'Reject an unknown ID or a group that still has children',
          actions: {
            type: 'Emit layer rejected',
            params: ({ context, event }) => ({
              layerId: event.layerId,
              reason: getRemoveLayerRejection(event.layerId, context) ?? '',
            }),
          },
        },
      ],
      'LAYER.MOVE': [
        {
          guard: {
            type: 'canMoveLayer',
            params: ({ event }) => event,
          },
          description: 'Place the layer or group at its new place in the order and report the new order',
          actions: [
            {
              type: 'Move layer',
              params: ({ event }) => event,
            },
            {
              type: 'Emit update layer order',
            },
          ],
        },
        {
          description: 'Reject an unknown ID',
          actions: {
            type: 'Emit layer rejected',
            params: ({ context, event }) => ({
              layerId: event.layerId,
              reason: getMoveLayerRejection(context, event) ?? '',
            }),
          },
        },
      ],

      'RESET': {
        description: 'Stop and remove every layer and group, and report an empty order',
        actions: ['Reset layer manager', 'Emit update layer order'],
      },
    },
  });
}
