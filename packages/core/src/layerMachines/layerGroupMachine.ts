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
          enqueue.sendTo(context.parentRef, {
            type: 'CHILD.VISIBLE',
            layerId: context.layerId,
          });
        }
      }),
      'Notify Manager of visibility change': enqueueActions(
        ({ context, enqueue }, params: { visible: boolean }) => {
          enqueue.sendTo(context.layerManagerRef, {
            type: 'LAYER.UPDATE_VISIBILITY',
            layerId: context.layerId,
            visible: params.visible,
          });
        },
      ),
      'Change Layer Data': enqueueActions(({ context, enqueue }, params: { layerData: TGroup }) => {
        enqueue.assign({ layerData: params.layerData });
        enqueue.sendTo(context.layerManagerRef, {
          type: 'LAYER.UPDATE_LAYER_DATA',
          layerId: context.layerId,
          layerData: params.layerData,
        });
      }),
      'Update Computed Opacity': enqueueActions(({ context, enqueue }, params: { opacity: number }) => {
        const computedOpacity = params.opacity * context.opacity;
        enqueue.assign({
          parentOpacity: params.opacity,
          computedOpacity,
        });
        // Notify children of the new computed opacity
        context.children.forEach((child) => {
          enqueue.sendTo(child, {
            type: 'PARENT.OPACITY_CHANGED',
            opacity: computedOpacity,
          });
        });
        enqueue.sendTo(context.layerManagerRef, {
          type: 'LAYER.UPDATE_OPACITY',
          layerId: context.layerId,
          opacity: context.opacity,
          computedOpacity,
        });
      }),
      'Change Layer Opacity': enqueueActions(
        ({ context, enqueue }, params: { opacity: number }) => {
          const computedOpacity = context.parentOpacity * params.opacity;
          enqueue.assign({
            opacity: params.opacity,
            computedOpacity,
          });
          enqueue.sendTo(context.layerManagerRef, {
            type: 'LAYER.UPDATE_OPACITY',
            layerId: context.layerId,
            opacity: params.opacity,
            computedOpacity,
          });
          context.children.forEach((child) => {
            enqueue.sendTo(child, {
              type: 'PARENT.OPACITY_CHANGED',
              opacity: computedOpacity,
            });
          });
        },
      ),
      'Change Layer Time Info': enqueueActions(
        ({ context, enqueue }, params: { timeInfo: LayerTimeInfo }) => {
          enqueue.assign({ timeInfo: params.timeInfo });
          enqueue.sendTo(context.layerManagerRef, {
            type: 'LAYER.UPDATE_TIME_INFO',
            layerId: context.layerId,
            timeInfo: params.timeInfo,
          });
        },
      ),
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
        description: 'The layer group is disabled',
        initial: 'hidden',
        states: {
          hidden: {
            description: 'The layer group and its children always appear hidden on the map',
          },
        },
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
