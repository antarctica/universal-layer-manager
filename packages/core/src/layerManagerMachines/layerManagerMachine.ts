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
  isSamePlacement,
} from '../utils';

export type LayerManagerMachine<TLayer, TGroup = undefined> = ReturnType<typeof createLayerManagerMachine<TLayer, TGroup>>;
export type LayerManagerActor<TLayer, TGroup = undefined> = ActorRefFrom<LayerManagerMachine<TLayer, TGroup>>;

export function createLayerManagerMachine<TLayer, TGroup = undefined>() {
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

        const startsShowing = (visible ?? false) || ((enabled ?? false) && (!parentRef || parentRef.getSnapshot().hasTag('visible')));

        function getStartState(enabled: boolean, visible: boolean): LayerStartState {
          return enabled || visible ? 'enabled.hidden' : 'disabled';
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

        enqueue.emit({ type: 'LAYER.ADDED', layerId: layerConfig.layerId });
        if (startsShowing) {
          enqueue.sendTo(layerConfig.layerId, { type: 'LAYER.START_SHOWING' });
        }
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
        const oldParentId = findParentGroupId(context, params.layerId) ?? null;
        const oldParentRef = oldParentId ? findParentLayerGroupActor(context.layers, oldParentId) : null;
        const newParentRef = params.parentId ? findParentLayerGroupActor(context.layers, params.parentId) : null;
        const movedActor = findManagedLayerById(context.layers, params.layerId)?.layerActor;

        enqueue.assign(({ context }) => getUpdatedLayerStructureAfterMove(context, params));

        if (oldParentRef && oldParentRef !== newParentRef) {
          enqueue.sendTo(oldParentRef, ({ context }) => getGroupChildrenChangedEvent(context, oldParentRef.id));
        }
        if (newParentRef) {
          enqueue.sendTo(newParentRef, ({ context }) => getGroupChildrenChangedEvent(context, newParentRef.id));
        }
        if (movedActor && oldParentRef !== newParentRef) {
          enqueue.sendTo(movedActor, {
            type: 'PARENT.CHANGED',
            parentRef: newParentRef,
            parentOpacity: newParentRef?.getSnapshot().context.computedOpacity ?? 1,
            parentVisible: newParentRef?.getSnapshot().hasTag('visible') ?? true,
          });
        }
      }),

      'Emit layer rejected': emit((_, params: { layerId: string; reason: string }) => ({
        type: 'LAYER.REJECTED',
        layerId: params.layerId,
        reason: params.reason,
      })),

      'Emit layer moved': emit((_, params: MoveLayerParams) => ({
        type: 'LAYER.MOVED',
        layerId: params.layerId,
        parentId: params.parentId,
      })),

      'Emit update layer order': emit(({ context }) => ({
        type: 'LAYER.ORDER_CHANGED',
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
      isRejectedMove: ({ context }, params: MoveLayerParams) => getMoveLayerRejection(context, params) !== undefined,
      isNewPlacement: ({ context }, params: MoveLayerParams) => !isSamePlacement(context, params),
      isManagedLayer: ({ context }, params: { layerId: string }) => findManagedLayerById(context.layers, params.layerId) !== undefined,
    },
  }).createMachine({
    id: 'layerManager',
    description: 'This machine keeps the layer tree and the layer order. This machine starts each layer actor and each group actor. This machine sends the changes from those actors to its listeners.',
    context: ({ input }) => ({
      layers: [],
      childLayerOrder: [],
      groupChildLayerOrder: {},
      allowNestedGroupLayers: input.allowNestedGroupLayers,
    }),
    on: {
      'CHILD.VISIBILITY_CHANGED': {
        guard: { type: 'isManagedLayer', params: ({ event }) => ({ layerId: event.layerId }) },
        description: 'A layer or a group becomes visible or hidden. If the manager still has that layer or group, the manager sends the change.',
        actions: emit(({ event }) => ({
          type: 'LAYER.VISIBILITY_CHANGED',
          layerId: event.layerId,
          visible: event.visible,
        })),
      },
      'CHILD.ENABLED_CHANGED': {
        guard: { type: 'isManagedLayer', params: ({ event }) => ({ layerId: event.layerId }) },
        description: 'A layer or a group switches on or off. If the manager still has that layer or group, the manager sends the change.',
        actions: emit(({ event }) => ({
          type: 'LAYER.ENABLED_CHANGED',
          layerId: event.layerId,
          enabled: event.enabled,
        })),
      },
      'CHILD.OPACITY_CHANGED': {
        guard: { type: 'isManagedLayer', params: ({ event }) => ({ layerId: event.layerId }) },
        description: 'A layer or a group changes its opacity. If the manager still has that layer or group, the manager sends the change.',
        actions: [
          emit(({ event }) => ({
            type: 'LAYER.OPACITY_CHANGED',
            layerId: event.layerId,
            opacity: event.opacity,
            computedOpacity: event.computedOpacity,
          })),
        ],
      },
      'CHILD.REJECTED': {
        guard: { type: 'isManagedLayer', params: ({ event }) => ({ layerId: event.layerId }) },
        description: 'A layer or a group rejects an action. If the manager still has that layer or group, the manager sends the rejection.',
        actions: emit(({ event }) => ({
          type: 'LAYER.REJECTED',
          layerId: event.layerId,
          reason: event.reason,
        })),
      },
      'CHILD.TIME_INFO_CHANGED': {
        guard: { type: 'isManagedLayer', params: ({ event }) => ({ layerId: event.layerId }) },
        description: 'A layer or a group changes its time info. If the manager still has that layer or group, the manager sends the change.',
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
        description: 'A layer or a group changes its data. If the manager still has that layer or group, the manager sends the change.',
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
          description: 'The manager starts the new layer or group. The manager puts that layer or group in the order of its parent. The manager sends the new order.',
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
          description: 'The manager rejects an add request if the ID is already in use. The manager rejects an add request if the parent group does not exist. The manager rejects a nested group if nested groups are not permitted. The manager rejects an opacity that is not a number from 0 to 1. The manager sends the rejection.',
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
          description: 'The manager stops the layer or the empty group. The manager removes that layer or group from the order. The manager sends the new order.',
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
          description: 'The manager rejects a remove request for an unknown ID. The manager rejects a remove request for a group that still has child layers. The manager sends the rejection.',
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
            type: 'isRejectedMove',
            params: ({ event }) => event,
          },
          description: 'The manager rejects a move for an unknown ID. The manager rejects a move if the new parent is not a group. The manager rejects a move of a group into a group if nested groups are not permitted. The manager rejects a move of a group into itself or into a group inside it. The manager sends the rejection.',
          actions: {
            type: 'Emit layer rejected',
            params: ({ context, event }) => ({
              layerId: event.layerId,
              reason: getMoveLayerRejection(context, event) ?? '',
            }),
          },
        },
        {
          guard: {
            type: 'isNewPlacement',
            params: ({ event }) => event,
          },
          description: 'If the move changes the parent or the order, the manager puts the layer or group in its new place. The manager sends the new order. The manager sends the move.',
          actions: [
            {
              type: 'Move layer',
              params: ({ event }) => event,
            },
            {
              type: 'Emit update layer order',
            },
            {
              type: 'Emit layer moved',
              params: ({ event }) => event,
            },
          ],
        },
      ],

      'RESET': {
        description: 'The manager stops each layer and each group. The manager removes each layer and each group. The manager sends an empty order.',
        actions: ['Reset layer manager', 'Emit update layer order'],
      },
    },
  });
}
