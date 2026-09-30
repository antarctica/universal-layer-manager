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
import {
  childVisibleNotice,
  layerDataChange,
  ownOpacityChange,
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
    actions: {
      'Notify Parent that layer is visible': enqueueActions(({ context, enqueue }) => {
        if (context.parentRef) {
          enqueue.sendTo(context.parentRef, childVisibleNotice(context));
        }
      }),
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
          { guard: ({ context }) => context.startState === 'enabled.visible', target: 'enabled.visible' },
          { guard: ({ context }) => context.startState === 'enabled.hidden', target: 'enabled.hidden' },
          { target: 'disabled' },
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
              },
            },
          },
          hidden: {
            description: 'The layer should appear hidden on the map as its parent is hidden',
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
        description: 'The layer is disabled and always appears hidden on the map',
        on: {
          'LAYER.ENABLED': {
            target: 'enabled.visible',
          },
        },
      },
    },
    on: {
      'PARENT.OPACITY_CHANGED': {
        actions: [
          {
            type: 'Update Computed Opacity',
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
      'LAYER.SET_LAYER_DATA': {
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
