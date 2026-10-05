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
    description: 'A machine that represents a layer on the map.',
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
        description: 'Resolves the state the layer starts in from its input',
        always: [
          { guard: ({ context }) => context.startState === 'enabled.visible', target: 'enabled.visible', description: 'Added switched on, with every group above showing' },
          { guard: ({ context }) => context.startState === 'enabled.hidden', target: 'enabled.hidden', description: 'Added switched on under a group that is not showing' },
          { target: 'disabled', description: 'Added switched off' },
        ],
      },
      enabled: {
        initial: 'visible',
        description: 'The layer is enabled',
        tags: ['enabled'],
        states: {
          visible: {
            description: 'The layer should appear visible on the map',
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
                description: 'A group above stopped showing: hide, but stay switched on',
              },
              'PARENT.CHANGED': [
                {
                  guard: ({ event }) => event.parentVisible,
                  description: 'Moved under a showing group: stay shown',
                  actions: {
                    type: 'Change Parent',
                    params: ({ event }) => event,
                  },
                },
                {
                  target: 'hidden',
                  description: 'Moved under a group that is not showing: hide, stay switched on',
                  actions: {
                    type: 'Change Parent',
                    params: ({ event }) => event,
                  },
                },
              ],
            },
          },
          hidden: {
            description: 'The layer should appear hidden on the map as its parent is hidden',
            on: {
              'LAYER.SHOW': {
                description: 'Asked to show: tell the parent group so every group above switches on',
                actions: 'Notify Parent that layer is visible',
              },
              'PARENT.VISIBLE': {
                target: 'visible',
                description: 'Every group above is showing again: show',
              },
              'PARENT.CHANGED': [
                {
                  guard: ({ event }) => event.parentVisible,
                  target: 'visible',
                  description: 'Moved under a showing group: show',
                  actions: {
                    type: 'Change Parent',
                    params: ({ event }) => event,
                  },
                },
                {
                  description: 'Moved under a group that is not showing: stay hidden, stay switched on',
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
            description: 'Switched off: hide whatever the groups above are doing, and report it to the manager',
            actions: {
              type: 'Notify Manager of enabled change',
              params: { enabled: false },
            },
          },
        },
      },
      disabled: {
        description: 'The layer is disabled and always appears hidden on the map',
        on: {
          'LAYER.ENABLED': {
            target: 'enabled.visible',
            description: 'Switched on: show, tell the parent group so every group above switches on, and report it to the manager',
            actions: {
              type: 'Notify Manager of enabled change',
              params: { enabled: true },
            },
          },
          'LAYER.SHOW': {
            target: 'enabled.visible',
            description: 'Asked to show: switch on, show, tell the parent group so every group above switches on, and report it to the manager',
            actions: {
              type: 'Notify Manager of enabled change',
              params: { enabled: true },
            },
          },
          'PARENT.CHANGED': {
            description: 'Moved while switched off: stay off',
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
        description: 'A group above changed opacity: recompute computed opacity from the opacity it sent',
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
          description: 'Reject an opacity outside 0 to 1 and report it to the manager',
          actions: {
            type: 'Notify Manager of opacity rejection',
            params: ({ event }) => event,
          },
        },
        {
          guard: { type: 'isNewOpacity', params: ({ event }) => ({ opacity: event.opacity }) },
          description: 'Set own opacity, unless it is unchanged: computed opacity combines it with the last opacity the parent sent',
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
        description: 'Store new time info and report it to the manager, unless it is unchanged',
        actions: [
          {
            type: 'Change Layer Time Info',
            params: ({ event }) => event,
          },
        ],
      },
      'LAYER.SET_LAYER_DATA': {
        description: 'Store new layer data and report it to the manager',
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
