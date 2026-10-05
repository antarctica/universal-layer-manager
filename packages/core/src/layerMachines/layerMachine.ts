import type {
  LayerContext,
  LayerEvent,
  LayerManagerRef,
  LayerStartState,
  LayerStateTag,
  LayerTimeInfo,
  ParentLayerActor,
} from '../types';

import { enqueueActions, setup } from 'xstate';
import { isOpacityInRange, isSameTimeInfo } from '../utils';
import {
  childVisibleNotice,
  enabledChange,
  layerDataChange,
  opacityRejection,
  ownOpacityChange,
  parentChange,
  parentOpacityChange,
  timeInfoChange,
  visibilityChange,
} from './layerChanges';

export function layerMachine<TLayer, TGroup = TLayer>() {
  return setup({
    types: {
      context: {} as LayerContext<TLayer, TGroup>,
      events: {} as LayerEvent<TLayer>,
      tags: {} as LayerStateTag,
      input: {} as {
        layerManagerRef: LayerManagerRef<TLayer, TGroup>;
        layerId: string;
        parentRef: ParentLayerActor | null;
        layerName: string;
        listMode?: 'show' | 'hide';
        opacity?: number;
        timeInfo?: LayerTimeInfo;
        layerData: TLayer;
        startState?: LayerStartState;
        parentOpacity?: number;
      },
    },
    guards: {
      isInvalidOpacity: (_, params: { opacity: number }) =>
        !isOpacityInRange(params.opacity),
      isNewOpacity: ({ context }, params: { opacity: number }) =>
        context.opacity !== params.opacity,
      isNewTimeInfo: ({ context }, params: { timeInfo: LayerTimeInfo }) =>
        !isSameTimeInfo(context.timeInfo, params.timeInfo),
    },
    actions: {
      'Notify Parent that layer is visible': enqueueActions(({ context, enqueue }) => {
        if (context.parentRef) {
          enqueue.sendTo(context.parentRef, childVisibleNotice(context));
        }
      }),
      'Notify Manager of opacity rejection': enqueueActions(
        ({ context, enqueue }, params: { opacity: number }) =>
          enqueue.sendTo(context.layerManagerRef, opacityRejection(context, params.opacity).notification),
      ),
      'Notify Manager of enabled change': enqueueActions(
        ({ context, enqueue }, params: { enabled: boolean }) =>
          enqueue.sendTo(context.layerManagerRef, enabledChange(context, params.enabled).notification),
      ),
      'Notify Manager of visibility change': enqueueActions(
        ({ context, enqueue }, params: { visible: boolean }) =>
          enqueue.sendTo(context.layerManagerRef, visibilityChange(context, params.visible).notification),
      ),
      'Update Computed Opacity': enqueueActions(({ context, enqueue }, params: { opacity: number }) => {
        const { update, notification } = parentOpacityChange(context, params.opacity);
        enqueue.assign(update);
        enqueue.sendTo(context.layerManagerRef, notification);
      }),
      'Change Layer Opacity': enqueueActions(({ context, enqueue }, params: { opacity: number }) => {
        const { update, notification } = ownOpacityChange(context, params.opacity);
        enqueue.assign(update);
        enqueue.sendTo(context.layerManagerRef, notification);
      }),
      'Change Layer Time Info': enqueueActions(({ context, enqueue }, params: { timeInfo: LayerTimeInfo }) => {
        const { update, notification } = timeInfoChange(context, params.timeInfo);
        enqueue.assign(update);
        enqueue.sendTo(context.layerManagerRef, notification);
      }),
      'Change Parent': enqueueActions(({ context, enqueue }, params: { parentRef: ParentLayerActor | null; parentOpacity: number }) => {
        const { update, notification } = parentChange(context, params.parentRef, params.parentOpacity);
        enqueue.assign(update);
        if (notification) {
          enqueue.sendTo(context.layerManagerRef, notification);
        }
      }),
      'Change Layer Data': enqueueActions(({ context, enqueue }, params: { layerData: TLayer }) => {
        const { update, notification } = layerDataChange(context, params.layerData);
        enqueue.assign(update);
        enqueue.sendTo(context.layerManagerRef, notification);
      }),
    },
  }).createMachine({
    id: 'layer',
    description: 'This machine is one layer on the map.',
    context: ({ input }) => {
      const opacity = input.opacity ?? 1;
      const parentOpacity = input.parentOpacity ?? 1;
      return {
        layerManagerRef: input.layerManagerRef,
        parentRef: input.parentRef,
        layerId: input.layerId,
        layerName: input.layerName,
        listMode: input.listMode ?? 'show',
        opacity,
        parentOpacity,
        computedOpacity: parentOpacity * opacity,
        layerType: 'layer',
        timeInfo: input.timeInfo,
        layerData: input.layerData,
        startState: input.startState ?? 'disabled',
      };
    },
    initial: 'starting',
    states: {
      starting: {
        description: 'The layer goes to its start state. The input sets the start state.',
        always: [
          { guard: ({ context }) => context.startState === 'enabled.visible', target: 'enabled.visible', description: 'The layer starts switched on. Each group above the layer is visible.' },
          { guard: ({ context }) => context.startState === 'enabled.hidden', target: 'enabled.hidden', description: 'The layer starts switched on. A group above the layer is hidden.' },
          { target: 'disabled', description: 'The layer starts switched off.' },
        ],
      },
      enabled: {
        initial: 'visible',
        description: 'The layer is switched on. When the layer switches off, the layer sends the change to the manager.',
        tags: ['enabled'],
        exit: {
          type: 'Notify Manager of enabled change',
          params: { enabled: false },
        },
        states: {
          visible: {
            description: 'The layer is visible on the map.',
            tags: ['visible'],
            entry: [
              {
                type: 'Notify Parent that layer is visible',
              },
              {
                type: 'Notify Manager of visibility change',
                params: {
                  visible: true,
                },
              },
            ],
            exit: [
              {
                type: 'Notify Manager of visibility change',
                params: {
                  visible: false,
                },
              },
            ],
            on: {
              'PARENT.HIDDEN': {
                target: 'hidden',
                description: 'A group above the layer becomes hidden. The layer hides. The layer stays switched on.',
              },
              'PARENT.CHANGED': [
                {
                  guard: ({ event }) => event.parentVisible,
                  description: 'The layer moves under a visible group. The layer stays visible.',
                  actions: {
                    type: 'Change Parent',
                    params: ({ event }) => event,
                  },
                },
                {
                  target: 'hidden',
                  description: 'The layer moves under a hidden group. The layer hides. The layer stays switched on.',
                  actions: {
                    type: 'Change Parent',
                    params: ({ event }) => event,
                  },
                },
              ],
            },
          },
          hidden: {
            description: 'The layer is hidden on the map because its parent group is hidden.',
            on: {
              'LAYER.SHOW': {
                description: 'The layer receives a show request. The layer sends a notice to its parent group. Each group above the layer switches on.',
                actions: 'Notify Parent that layer is visible',
              },
              'PARENT.VISIBLE': {
                target: 'visible',
                description: 'Each group above the layer is visible again. The layer shows.',
              },
              'PARENT.CHANGED': [
                {
                  guard: ({ event }) => event.parentVisible,
                  target: 'visible',
                  description: 'The layer moves under a visible group. The layer shows.',
                  actions: {
                    type: 'Change Parent',
                    params: ({ event }) => event,
                  },
                },
                {
                  description: 'The layer moves under a hidden group. The layer stays hidden. The layer stays switched on.',
                  actions: {
                    type: 'Change Parent',
                    params: ({ event }) => event,
                  },
                },
              ],
            },
          },
        },
        on: {
          'LAYER.DISABLED': {
            target: 'disabled',
            description: 'The layer switches off. The layer hides. The groups above the layer have no effect.',
          },
        },
      },
      disabled: {
        description: 'The layer is switched off. The layer is always hidden on the map. When the layer switches on, the layer sends the change to the manager.',
        exit: {
          type: 'Notify Manager of enabled change',
          params: { enabled: true },
        },
        on: {
          'LAYER.ENABLED': {
            target: 'enabled.visible',
            description: 'The layer switches on. The layer shows. The layer sends a notice to its parent group. Each group above the layer switches on.',
          },
          'LAYER.SHOW': {
            target: 'enabled.visible',
            description: 'The layer receives a show request. The layer switches on. The layer shows. The layer sends a notice to its parent group. Each group above the layer switches on.',
          },
          'PARENT.CHANGED': {
            description: 'The layer moves while the layer is switched off. The layer stays switched off.',
            actions: {
              type: 'Change Parent',
              params: ({ event }) => event,
            },
          },
        },
      },
    },
    on: {
      'PARENT.OPACITY_CHANGED': {
        description: 'A group above the layer sends a new opacity. The layer calculates its computed opacity from that opacity. The layer sends the change to the manager.',
        actions: [
          {
            type: 'Update Computed Opacity',
            params: ({ event }) => event,
          },
        ],
      },
      'LAYER.SET_OPACITY': [
        {
          guard: { type: 'isInvalidOpacity', params: ({ event }) => ({ opacity: event.opacity }) },
          description: 'The layer rejects an opacity that is not a number from 0 to 1. The layer sends the rejection to the manager.',
          actions: {
            type: 'Notify Manager of opacity rejection',
            params: ({ event }) => event,
          },
        },
        {
          guard: { type: 'isNewOpacity', params: ({ event }) => ({ opacity: event.opacity }) },
          description: 'If the opacity is different from the current opacity, the layer stores the new opacity. The computed opacity is the layer opacity times the parent opacity. The layer sends the change to the manager.',
          actions: [
            {
              type: 'Change Layer Opacity',
              params: ({ event }) => event,
            },
          ],
        },
      ],
      'LAYER.SET_TIME_INFO': {
        guard: { type: 'isNewTimeInfo', params: ({ event }) => ({ timeInfo: event.timeInfo }) },
        description: 'If the time info is different from the current time info, the layer stores the new time info. The layer sends the change to the manager.',
        actions: [
          {
            type: 'Change Layer Time Info',
            params: ({ event }) => event,
          },
        ],
      },
      'LAYER.SET_LAYER_DATA': {
        description: 'The layer stores the new layer data. The layer sends the change to the manager.',
        actions: [
          {
            type: 'Change Layer Data',
            params: ({ event }) => event,
          },
        ],
      },
    },
  });
}
