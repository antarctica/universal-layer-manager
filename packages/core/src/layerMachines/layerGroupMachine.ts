import type {
  ChildLayerActor,
  LayerGroupContext,
  LayerGroupEvent,
  LayerManagerRef,
  LayerStartState,
  LayerStateTag,
  LayerTimeInfo,
  ParentLayerActor,
} from '../types';

import { assign, enqueueActions, setup } from 'xstate';
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

export function layerGroupMachine<TLayer, TGroup = undefined>() {
  return setup({
    types: {
      context: {} as LayerGroupContext<TLayer, TGroup>,
      events: {} as LayerGroupEvent<TGroup>,
      tags: {} as LayerStateTag,
      input: {} as {
        layerId: string;
        parentRef: ParentLayerActor | null;
        layerName: string;
        layerManagerRef: LayerManagerRef<TLayer, TGroup>;
        listMode?: 'show' | 'hide' | 'hide-children';
        timeInfo?: LayerTimeInfo;
        opacity?: number;
        layerData: TGroup;
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
      'Notify Manager of opacity rejection': enqueueActions(
        ({ context, enqueue }, params: { opacity: number }) =>
          enqueue.sendTo(context.layerManagerRef, opacityRejection(context, params.opacity).notification),
      ),
      'Notify children of visibility change': enqueueActions(
        ({ context, enqueue }, params: { visible: boolean }) => {
          context.children.forEach((child) => {
            enqueue.sendTo(child, { type: params.visible ? 'PARENT.VISIBLE' : 'PARENT.HIDDEN' });
          });
        },
      ),
      'Notify Parent that layer is visible': enqueueActions(({ context, enqueue }) => {
        if (context.parentRef) {
          enqueue.sendTo(context.parentRef, childVisibleNotice(context));
        }
      }),
      'Notify Manager of enabled change': enqueueActions(
        ({ context, enqueue }, params: { enabled: boolean }) =>
          enqueue.sendTo(context.layerManagerRef, enabledChange(context, params.enabled).notification),
      ),
      'Notify Manager of visibility change': enqueueActions(
        ({ context, enqueue }, params: { visible: boolean }) => {
          enqueue.sendTo(context.layerManagerRef, visibilityChange(context, params.visible).notification);
        },
      ),
      'Change Layer Data': enqueueActions(({ context, enqueue }, params: { layerData: TGroup }) => {
        const { update, notification } = layerDataChange(context, params.layerData);
        enqueue.assign(update);
        enqueue.sendTo(context.layerManagerRef, notification);
      }),
      'Update Computed Opacity': enqueueActions(({ context, enqueue }, params: { opacity: number }) => {
        const { update, notification } = parentOpacityChange(context, params.opacity);
        enqueue.assign(update);
        if (update.computedOpacity === context.computedOpacity) {
          return;
        }
        context.children.forEach((child) => {
          enqueue.sendTo(child, { type: 'PARENT.OPACITY_CHANGED', opacity: update.computedOpacity });
        });
        enqueue.sendTo(context.layerManagerRef, notification);
      }),
      'Change Layer Opacity': enqueueActions(({ context, enqueue }, params: { opacity: number }) => {
        const { update, notification } = ownOpacityChange(context, params.opacity);
        enqueue.assign(update);
        enqueue.sendTo(context.layerManagerRef, notification);
        context.children.forEach((child) => {
          enqueue.sendTo(child, { type: 'PARENT.OPACITY_CHANGED', opacity: update.computedOpacity });
        });
      }),
      'Change Parent': enqueueActions(({ context, enqueue }, params: { parentRef: ParentLayerActor | null; parentOpacity: number }) => {
        const { update, notification } = parentChange(context, params.parentRef, params.parentOpacity);
        enqueue.assign(update);
        if (notification) {
          enqueue.sendTo(context.layerManagerRef, notification);
          context.children.forEach((child) => {
            enqueue.sendTo(child, { type: 'PARENT.OPACITY_CHANGED', opacity: update.computedOpacity });
          });
        }
      }),
      'Change Layer Time Info': enqueueActions(({ context, enqueue }, params: { timeInfo: LayerTimeInfo }) => {
        const { update, notification } = timeInfoChange(context, params.timeInfo);
        enqueue.assign(update);
        enqueue.sendTo(context.layerManagerRef, notification);
      }),
      'Set Children': assign((_, params: { children: ChildLayerActor[]; childLayerOrder: string[] }) => ({
        children: params.children,
        childLayerOrder: params.childLayerOrder,
      })),
    },
  }).createMachine({
    id: 'layerGroup',
    description: 'This machine is one group of layers on the map. When this group hides, its child layers hide.',
    initial: 'starting',
    context: ({ input }) => {
      const opacity = input.opacity ?? 1;
      const parentOpacity = input.parentOpacity ?? 1;
      return {
        layerManagerRef: input.layerManagerRef,
        layerId: input.layerId,
        parentRef: input.parentRef,
        children: [],
        childLayerOrder: [],
        layerName: input.layerName,
        layerType: 'layerGroup',
        listMode: input.listMode ?? 'show',
        timeInfo: input.timeInfo,
        layerData: input.layerData,
        opacity,
        parentOpacity,
        computedOpacity: parentOpacity * opacity,
        startState: input.startState ?? 'disabled',
      };
    },
    states: {
      starting: {
        description: 'This group goes to its start state. The input sets the start state.',
        always: [
          { guard: ({ context }) => context.startState === 'enabled.hidden', target: 'enabled.hidden', description: 'This group starts switched on. A group above this group is hidden.' },
          { target: 'disabled', description: 'This group starts switched off.' },
        ],
      },
      enabled: {
        initial: 'visible',
        description: 'This group is switched on. When this group switches off, this group sends the change to the manager.',
        tags: ['enabled'],
        exit: {
          type: 'Notify Manager of enabled change',
          params: { enabled: false },
        },
        states: {
          visible: {
            description: 'This group is visible on the map.',
            tags: ['visible'],
            entry: [
              {
                type: 'Notify Parent that layer is visible',
              },
              {
                type: 'Notify children of visibility change',
                params: { visible: true },
              },
              {
                type: 'Notify Manager of visibility change',
                params: { visible: true },
              },
            ],
            exit: [
              {
                type: 'Notify Manager of visibility change',
                params: { visible: false },
              },
              {
                type: 'Notify children of visibility change',
                params: { visible: false },
              },
            ],
            on: {
              'PARENT.HIDDEN': {
                target: 'hidden',
                description: 'A group above this group becomes hidden. This group hides. Its child layers hide. This group and its child layers stay switched on.',
              },
              'PARENT.CHANGED': [
                {
                  guard: ({ event }) => event.parentVisible,
                  description: 'This group moves under a visible group. This group stays visible.',
                  actions: {
                    type: 'Change Parent',
                    params: ({ event }) => event,
                  },
                },
                {
                  target: 'hidden',
                  description: 'This group moves under a hidden group. This group hides. Its child layers hide. This group and its child layers stay switched on.',
                  actions: {
                    type: 'Change Parent',
                    params: ({ event }) => event,
                  },
                },
              ],
            },
          },
          hidden: {
            description: 'This group is hidden on the map because its parent group is hidden.',
            on: {
              'LAYER.SHOW': {
                description: 'This group receives a show request. This group sends a notice to its parent group. Each group above this group switches on.',
                actions: 'Notify Parent that layer is visible',
              },
              'LAYER.START_SHOWING': {
                target: 'visible',
                description: 'The manager added this group as visible. This group shows. Each child layer that is switched on shows.',
              },
              'PARENT.VISIBLE': {
                target: 'visible',
                description: 'Each group above this group is visible again. This group shows. Each child layer that is switched on shows.',
              },
              'PARENT.CHANGED': [
                {
                  guard: ({ event }) => event.parentVisible,
                  target: 'visible',
                  description: 'This group moves under a visible group. This group shows. Each child layer that is switched on shows.',
                  actions: {
                    type: 'Change Parent',
                    params: ({ event }) => event,
                  },
                },
                {
                  description: 'This group moves under a hidden group. This group stays hidden. This group stays switched on.',
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
            description: 'This group switches off. This group hides. Its child layers hide. Each child layer that is switched on stays switched on.',
          },
        },
      },
      disabled: {
        description: 'This group is switched off. This group and its child layers are always hidden on the map. When this group switches on, this group sends the change to the manager.',
        exit: {
          type: 'Notify Manager of enabled change',
          params: { enabled: true },
        },
        on: {
          'LAYER.ENABLED': {
            target: 'enabled',
            description: 'This group switches on. This group shows. This group sends a notice to its parent group. Each child layer that is switched on shows.',
          },
          'LAYER.SHOW': {
            target: 'enabled',
            description: 'This group receives a show request. This group switches on. This group shows. This group sends a notice to its parent group. Each child layer that is switched on shows.',
          },
          'CHILD.VISIBLE': {
            target: 'enabled',
            description: 'A child layer switches on. This group switches on. Then the child layer can show.',
          },
          'PARENT.CHANGED': {
            description: 'This group moves while this group is switched off. This group stays switched off.',
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
        description: 'A group above this group sends a new opacity. This group calculates its computed opacity from that opacity. This group sends the change to the manager. This group sends the new computed opacity to its child layers.',
        actions: {
          type: 'Update Computed Opacity',
          params: ({ event }) => event,
        },
      },
      'CHILD.VISIBLE': {
        description: 'A child layer switches on while this group is switched on. This group sends a notice to its parent group. Each group above this group switches on. If this group is hidden, this group shows when each group above it is visible.',
        actions: 'Notify Parent that layer is visible',
      },
      'LAYERS.CHILDREN_CHANGED': {
        description: 'The manager sends new child layers for this group. This group stores the child layers in the order from the manager.',
        actions: {
          type: 'Set Children',
          params: ({ event }) => event,
        },
      },
      'LAYER.SET_LAYER_DATA': {
        description: 'This group stores the new group data. This group sends the change to the manager.',
        actions: [
          {
            type: 'Change Layer Data',
            params: ({ event }) => event,
          },
        ],
      },
      'LAYER.SET_OPACITY': [
        {
          guard: { type: 'isInvalidOpacity', params: ({ event }) => ({ opacity: event.opacity }) },
          description: 'This group rejects an opacity that is not a number from 0 to 1. This group sends the rejection to the manager.',
          actions: {
            type: 'Notify Manager of opacity rejection',
            params: ({ event }) => event,
          },
        },
        {
          guard: { type: 'isNewOpacity', params: ({ event }) => ({ opacity: event.opacity }) },
          description: 'If the opacity is different from the current opacity, this group stores the new opacity. The computed opacity is the group opacity times the parent opacity. This group sends the change to the manager. This group sends the new computed opacity to its child layers.',
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
        description: 'If the time info is different from the current time info, this group stores the new time info. This group sends the change to the manager.',
        actions: [
          {
            type: 'Change Layer Time Info',
            params: ({ event }) => event,
          },
        ],
      },
    },
  });
}
