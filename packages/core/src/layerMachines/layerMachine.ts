import type {
  LayerContext,
  LayerEvent,
  LayerManagerRef,
  LayerTimeInfo,
  ParentLayerActor,
} from '../types';

import { enqueueActions, setup } from 'xstate';
import { calculateComputedOpacity } from '../utils';

export function layerMachine<TLayer, TGroup = TLayer>(initialEnabledState: 'enabled' | 'disabled', initialVisibleState: 'visible' | 'hidden') {
  return setup({
    types: {
      context: {} as LayerContext<TLayer, TGroup>,
      events: {} as LayerEvent<TLayer>,
      input: {} as {
        layerManagerRef: LayerManagerRef<TLayer, TGroup>;
        layerId: string;
        parentRef: ParentLayerActor | null;
        layerName: string;
        listMode?: 'show' | 'hide';
        opacity?: number;
        timeInfo?: LayerTimeInfo;
        layerData: TLayer;
      },
    },
    actions: {
      'Notify Parent that layer is visible': enqueueActions(({ context, enqueue }) => {
        if (context.parentRef) {
          enqueue.sendTo(context.parentRef, {
            type: 'CHILD.VISIBLE',
            layerId: context.layerId,
          });
        }
      }),
      'Notify Manager of visibility change': enqueueActions(
        ({ context, enqueue }, params: { visible: boolean }) =>
          enqueue.sendTo(context.layerManagerRef, {
            type: 'LAYER.UPDATE_VISIBILITY',
            layerId: context.layerId,
            visible: params.visible,
          }),
      ),
      'Update Computed Opacity': enqueueActions(({ context, enqueue }, params: { opacity: number }) => {
        const computedOpacity = params.opacity * context.opacity;
        enqueue.assign({
          computedOpacity,
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
          const computedOpacity = calculateComputedOpacity(context.parentRef, params.opacity);
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
        },
      ),
      'Change Layer Time Info': enqueueActions(
        ({ context, enqueue }, params: { timeInfo: LayerTimeInfo }) => {
          enqueue.assign({
            timeInfo: params.timeInfo,
          });
          enqueue.sendTo(context.layerManagerRef, {
            type: 'LAYER.UPDATE_TIME_INFO',
            layerId: context.layerId,
            timeInfo: params.timeInfo,
          });
        },
      ),
      'Change Layer Data': enqueueActions(({ context, enqueue }, params: { layerData: TLayer }) => {
        enqueue.assign({ layerData: params.layerData });
        enqueue.sendTo(context.layerManagerRef, {
          type: 'LAYER.UPDATE_LAYER_DATA',
          layerId: context.layerId,
          layerData: params.layerData,
        });
      }),
    },
  }).createMachine({
    id: 'layer',
    description: 'A machine that represents a layer on the map.',
    context: ({ input }) => {
      const opacity = input.opacity ?? 1;
      const computedOpacity = calculateComputedOpacity(input.parentRef, opacity);
      return {
        layerManagerRef: input.layerManagerRef,
        parentRef: input.parentRef,
        layerId: input.layerId,
        layerName: input.layerName,
        listMode: input.listMode ?? 'show',
        opacity,
        computedOpacity,
        layerType: 'layer',
        timeInfo: input.timeInfo,
        layerData: input.layerData,
      };
    },
    initial: initialEnabledState,
    states: {
      enabled: {
        initial: initialVisibleState,
        description: 'The layer is enabled',
        states: {
          visible: {
            description: 'The layer should appear visible on the map',
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
        description: 'The layer is disabled',
        initial: 'hidden',
        states: {
          hidden: {
            description: 'The layer should always appear hidden on the map',
          },
        },
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
