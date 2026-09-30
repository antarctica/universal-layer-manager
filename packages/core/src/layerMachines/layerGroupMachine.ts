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
          { guard: ({ context }) => context.startState === 'enabled.visible', target: 'enabled.visible' },
          { guard: ({ context }) => context.startState === 'enabled.hidden', target: 'enabled.hidden' },
          { target: 'disabled' },
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
              },
            },
          },
          hidden: {
            description: 'The layer group should appear hidden on the map as its parent is hidden',
            on: {
              'PARENT.VISIBLE': {
                target: 'visible',
              },
            },
          },
        },
        on: {
          'LAYER.DISABLED': {
            target: 'disabled',
          },
        },
      },
      disabled: {
        description: 'The layer group is disabled, so it and its children always appear hidden on the map',
        on: {
          'LAYER.ENABLED': {
            target: 'enabled',
          },
          'CHILD.VISIBLE': {
            target: 'enabled',
          },
        },
      },
    },
    on: {
      'PARENT.OPACITY_CHANGED': {
        actions: {
          type: 'Update Computed Opacity',
          params: ({ event }) => event,
        },
      },
      'CHILD.VISIBLE': {
        actions: 'Notify Parent of visibility change',
      },
      'LAYERS.CHILDREN_CHANGED': {
        actions: {
          type: 'Set Children',
          params: ({ event }) => event,
        },
      },
      'LAYER.SET_LAYER_DATA': {
        actions: [
          {
            type: 'Change Layer Data',
            params: ({ event }) => event,
          },
        ],
      },
      'LAYER.SET_OPACITY': {
        actions: [
          {
            type: 'Change Layer Opacity',
            params: ({ event }) => event,
          },
        ],
      },
      'LAYER.SET_TIME_INFO': {
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
