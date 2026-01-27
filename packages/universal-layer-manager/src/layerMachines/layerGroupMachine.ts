import type {
  ChildLayerActor,
  LayerGroupContext,
  LayerGroupEvent,
  LayerManager,
  LayerTimeInfo,
  ParentLayerActor,
} from '../types';

import { assign, enqueueActions, setup } from 'xstate';
import { calculateComputedOpacity, updateLayerOrder } from '../utils';

export function layerGroupMachine<TLayer, TGroup = TLayer>() {
  return setup({
    types: {
      context: {} as LayerGroupContext<TLayer, TGroup>,
      events: {} as LayerGroupEvent<TGroup>,
      input: {} as {
        layerId: string;
        parentRef: ParentLayerActor | null;
        layerName: string;
        layerManagerRef: LayerManager<TLayer, TGroup>;
        listMode?: 'show' | 'hide' | 'hide-children';
        timeInfo?: LayerTimeInfo;
        opacity?: number;
        layerData: TGroup;
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
      'Notify children of opacity change': enqueueActions(({ context, enqueue }) => {
        context.children.forEach((child) => {
          enqueue.sendTo(child, {
            type: 'PARENT.OPACITY_CHANGED',
            opacity: context.computedOpacity,
          });
        });
      }),
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
      'Update Computed Opacity': enqueueActions(({ context, enqueue }) => {
        const computedOpacity = calculateComputedOpacity(context.parentRef, context.opacity);
        enqueue.assign({
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
          computedOpacity: context.computedOpacity,
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
      'Update Children': assign(
        (
          { context },
          params: {
            child: ChildLayerActor;
            index?: number;
            position?: 'top' | 'bottom';
          },
        ) => {
          const newOrder = updateLayerOrder(
            context.childLayerOrder,
            params.child.id,
            params.index,
            params.position,
          );
          return {
            children: [...context.children, params.child],
            childLayerOrder: newOrder,
          };
        },
      ),
      'Remove Child': assign(({ context }, params: { id: string }) => {
        return {
          children: context.children.filter((layer) => layer.id !== params.id),
          childLayerOrder: context.childLayerOrder.filter((layerId) => layerId !== params.id),
        };
      }),
    },
  }).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QBsCGBPMAnA4lg9gK4AOAxAMIASAkgDIAiAdAGrUDK1AQrQKIDaABgC6iUMXywAlgBdJ+AHaiQAD0QBOABwAmRmoCMAgCwa1mjQGYArAHYNAGhDp1jPRu221WgVssDLPgF8AhzRMXAISUloAQQBNHgAlNkZo+noAfSo6ekERJBBxKVkFJVUEa3M1XT0tDWtrY0tDNUMANgcnBCrXd1a9c2tLDT1LNVagkIxsPCIyGPikxgSeAFkAeWYeTJoGXKVCmTlFfLLDY0YK2wFXATcbGw7EEZdzZp99Hz0R14mQUOmIsRGGB5KgAEbISBROKJRj0djRbg8HLCfYSQ4lE6ILT9Ri3NRWNr9ATmcytcyPBADVqMJpfDSteqGLTWPSDX7-cKzYGgiGQRgAN0kUj5pAACtFlgA5AAqjBoaR4Ur2+QOxWOoDK9R01wMagalkqX2slN8hgu+j05Is5NG1g5Uy5JB54MhEEYAAtJBAICDxZKlXLWBwkSqxOj1aVENrdMZWk0NIZrK0tJ5KWcBBavpZGbc9IYbONgn9HTNnRBha6ofNYUrEbwUXlw0UjlGEDjzHiTIS+uYSWSKY5EEnrLTDDU-EMNL5GQ6wmWgRXYFWIBQdkxg1xeGGChHW1j27j8T3iaTyemWXjx3oxq5+t2gsX5PhffB8pyF2iW5jNYgALQ4ro8bmDU5g2imYxaJSXydkYxr9jmwF6HOALciCK5fhiGoqIgYHmrUBbDGy1g+EMlJaK05p0myWikomRhWChTpAuhfLukKIqQphkYHoY5g6ARQzGiRlhkUOVJjGO2bMhYzR+ExC4umxnrer62Fqvuv5dKJjAEa0AgGQYWiGCS6bNIwAwFgY46mDihgKYCjBLhhqp7j+OHtjSJJtHUfTkgMJL2OJpJ6Iw44pgI+pybUWgOdyznKV6PogtxmkeQ0eKvK0vlWqS1hGOm5JhVaN5Wi0Xx8eYj4BEAA */
    id: 'layerGroup',
    description: 'A machine that represents a collection of layers that can be toggled as a group',
    initial: 'disabled',
    context: ({ input }) => {
      const opacity = input.opacity ?? 1;
      const computedOpacity = calculateComputedOpacity(input.parentRef, opacity);
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
        computedOpacity,
      };
    },
    states: {
      enabled: {
        initial: 'visible',
        description: 'The layer group is enabled',
        states: {
          visible: {
            description: 'The layer group should appear visible on the map',
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
        actions: 'Update Computed Opacity',
      },
      'CHILD.VISIBLE': {
        actions: 'Notify Parent of visibility change',
      },
      'LAYERS.ADD_CHILD': {
        actions: [
          {
            type: 'Update Children',
            params: ({ event }) => event,
          },
        ],
      },
      'LAYERS.REMOVE_CHILD': {
        actions: [
          {
            type: 'Remove Child',
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
