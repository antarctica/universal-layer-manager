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
import {
  childVisibleNotice,
  layerDataChange,
  ownOpacityChange,
  parentOpacityChange,
  timeInfoChange,
  visibilityChange,
} from './layerChanges';

export function layerGroupMachine<TLayer, TGroup = TLayer>() {
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
    actions: {
      'Notify children of visibility change': enqueueActions(
        ({ context, enqueue }, params: { visible: boolean }) => {
          context.children.forEach((child) => {
            enqueue.sendTo(child, { type: params.visible ? 'PARENT.VISIBLE' : 'PARENT.HIDDEN' });
          });
        },
      ),
      'Notify Parent of visibility change': enqueueActions(({ context, enqueue }) => {
        if (context.parentRef) {
          enqueue.sendTo(context.parentRef, childVisibleNotice(context));
        }
      }),
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
    description: 'A machine that represents a collection of layers that can be toggled as a group',
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
        description: 'Resolves the state the layer group starts in from its input',
        always: [
          { guard: ({ context }) => context.startState === 'enabled.visible', target: 'enabled.visible', description: 'Added switched on, with every group above showing' },
          { guard: ({ context }) => context.startState === 'enabled.hidden', target: 'enabled.hidden', description: 'Added switched on under a group that is not showing' },
          { target: 'disabled', description: 'Added switched off' },
        ],
      },
      enabled: {
        initial: 'visible',
        description: 'The layer group is enabled',
        tags: ['enabled'],
        states: {
          visible: {
            description: 'The layer group should appear visible on the map',
            tags: ['visible'],
            entry: [
              {
                type: 'Notify Parent of visibility change',
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
                description: 'A group above stopped showing: hide this group and its children, which stay switched on',
              },
            },
          },
          hidden: {
            description: 'The layer group should appear hidden on the map as its parent is hidden',
            on: {
              'PARENT.VISIBLE': {
                target: 'visible',
                description: 'Every group above is showing again: show, and show the children that are switched on',
              },
            },
          },
        },
        on: {
          'LAYER.DISABLED': {
            target: 'disabled',
            description: 'Switched off: hide this group and its children, which stay switched on',
          },
        },
      },
      disabled: {
        description: 'The layer group is disabled, so it and its children always appear hidden on the map',
        on: {
          'LAYER.ENABLED': {
            target: 'enabled',
            description: 'Switched on: show, tell the parent group, and show the children that are switched on',
          },
          'CHILD.VISIBLE': {
            target: 'enabled',
            description: 'A child was switched on: switch this group on so the child can show',
          },
        },
      },
    },
    on: {
      'PARENT.OPACITY_CHANGED': {
        description: 'A group above changed opacity: recompute, and send the new computed opacity to the children',
        actions: {
          type: 'Update Computed Opacity',
          params: ({ event }) => event,
        },
      },
      'CHILD.VISIBLE': {
        description: 'A child was switched on while this group is on: pass it up so every group above switches on. A hidden group shows once its parent sends PARENT.VISIBLE',
        actions: 'Notify Parent of visibility change',
      },
      'LAYERS.CHILDREN_CHANGED': {
        description: 'The manager changed this group\'s children: store them in the manager\'s order',
        actions: {
          type: 'Set Children',
          params: ({ event }) => event,
        },
      },
      'LAYER.SET_LAYER_DATA': {
        description: 'Store new group data and report it to the manager',
        actions: [
          {
            type: 'Change Layer Data',
            params: ({ event }) => event,
          },
        ],
      },
      'LAYER.SET_OPACITY': {
        description: 'Set own opacity: recompute, and send the new computed opacity to the children',
        actions: [
          {
            type: 'Change Layer Opacity',
            params: ({ event }) => event,
          },
        ],
      },
      'LAYER.SET_TIME_INFO': {
        description: 'Store new time info and report it to the manager',
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
