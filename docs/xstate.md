# Working with XState

The `LayerManager` class is built on [XState](https://stately.ai/docs/xstate) state machines, and XState is installed as a dependency of `@ulm/core`. If you want more direct control, you can work with the underlying actors yourself.

## Why work with the actors?

`LayerManager`, its callbacks and adapters suit most uses: you make changes through one object and react to the results in one place.

In a reactive UI framework such as React, working with the actors directly is often simpler. Every layer and group is its own actor, so each component can subscribe to just the actor it displays and send events straight to it. A layer row subscribes to its own layer, and only re-renders when that layer changes. A date picker for one layer only needs that layer's actor. This makes it straightforward to build components for specific parts of your interface, without passing callbacks and state down from the top.

## The actors

There are three kinds of actor:

+ The **manager actor** holds the whole layer tree. Its context includes `layers`, every layer and group in the manager, and `childLayerOrder`, the order of the top-level items. Get it from `manager.actor`.
+ A **layer actor** holds one layer. Its context includes `layerName`, `layerData`, `opacity` and `timeInfo`.
+ A **group actor** holds one group. As well as the fields a layer has, its context includes `children` and `childLayerOrder`.

Each item in the manager's `layers` has a `type`, either `'layer'` or `'layerGroup'`, and a `layerActor`. The actor's `id` is the item's `layerId`.

## Using with React

Install [`@xstate/react`](https://stately.ai/docs/xstate-react) alongside `@ulm/core`:

```sh
npm install @xstate/react
```

### A layer row

This component shows a single layer. It reads from the layer's actor with `useSelector`, and sends events to it to switch the layer on and off:

```tsx
import type { LayerMachineActor } from '@ulm/core';
import { useSelector } from '@xstate/react';
import * as React from 'react';

function LayerRow({ layerActor }: { layerActor: LayerMachineActor<LayerData, undefined> }) {
  // each selector re-renders this row only when that value changes on this layer
  const layerName = useSelector(layerActor, (state) => state.context.layerName);
  const isEnabled = useSelector(layerActor, (state) => state.hasTag('enabled'));
  const isVisible = useSelector(layerActor, (state) => state.hasTag('visible'));

  return (
    <label style={{ opacity: isVisible ? 1 : 0.5 }}>
      <input
        type="checkbox"
        checked={isEnabled}
        onChange={() => layerActor.send({ type: isEnabled ? 'LAYER.DISABLED' : 'LAYER.ENABLED' })}
      />
      {layerName}
    </label>
  );
}
```

Use the `enabled` and `visible` tags to check a layer's state. They mean the same as [enabled and visible](./visibility-and-opacity#enabled-and-visible) elsewhere in the library.

### A group

A group row works the same way, using the group's actor. It also subscribes to the group's own `childLayerOrder`, and looks up each child with `manager.getLayer` to render its row:

```tsx
import type { LayerGroupMachineActor } from '@ulm/core';

function GroupRow({ groupActor }: { groupActor: LayerGroupMachineActor<LayerData, undefined> }) {
  const layerName = useSelector(groupActor, (state) => state.context.layerName);
  const isEnabled = useSelector(groupActor, (state) => state.hasTag('enabled'));
  // re-renders only when this group's own order changes
  const childLayerOrder = useSelector(groupActor, (state) => state.context.childLayerOrder);

  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={() => groupActor.send({ type: isEnabled ? 'LAYER.DISABLED' : 'LAYER.ENABLED' })}
        />
        {layerName}
      </label>
      <ul>
        {[...childLayerOrder].reverse().map((layerId) => {
          const child = manager.getLayer(layerId);
          return (
            <li key={layerId}>
              {child?.type === 'layer' && <LayerRow layerActor={child.layerActor} />}
            </li>
          );
        })}
      </ul>
    </>
  );
}
```

Switching the group off sends one event to the group's actor. Each `LayerRow` inside it then re-renders on its own, as its layer's `visible` tag changes.

### A layer list

The list subscribes to the manager actor for the top-level order, and renders a row for each layer or group:

```tsx
import { getTopLevelLayersInOrder } from '@ulm/core';

function LayerList() {
  const childLayerOrder = useSelector(manager.actor, ({ context }) => context.childLayerOrder);
  const layers = useSelector(manager.actor, ({ context }) => context.layers);

  // top first, the reverse of the manager's bottom-first order
  const items = React.useMemo(
    () => getTopLevelLayersInOrder(childLayerOrder, layers).reverse(),
    [childLayerOrder, layers],
  );

  return (
    <ul>
      {items.map((item) => (
        <li key={item.layerActor.id}>
          {item.type === 'layer'
            ? <LayerRow layerActor={item.layerActor} />
            : <GroupRow groupActor={item.layerActor} />}
        </li>
      ))}
    </ul>
  );
}
```

The [Leaflet example](./examples) builds a full layer list this way, including groups and drag-and-drop reordering.

## Sending events

`LayerManager` methods are a thin layer over events sent to the actors. You can send these events yourself.

To a layer or group actor:

| Event | Does the same as |
|---|---|
| `{ type: 'LAYER.ENABLED' }` / `{ type: 'LAYER.DISABLED' }` | `setEnabled` |
| `{ type: 'LAYER.SET_OPACITY', opacity }` | `setOpacity` |
| `{ type: 'LAYER.SET_TIME_INFO', timeInfo }` | `setTimeInfo` |
| `{ type: 'LAYER.SET_LAYER_DATA', layerData }` | `updateLayerData` |

To the manager actor:

| Event | Does the same as |
|---|---|
| `{ type: 'LAYER.ADD', params }` | `addLayer` / `addGroup` |
| `{ type: 'LAYER.REMOVE', layerId }` | `removeLayer` |
| `{ type: 'LAYER.MOVE', layerId, parentId, index?, position? }` | `moveLayer` |
| `{ type: 'RESET' }` | `reset` |

## Listening to the manager

The manager actor emits an event for every change, which you can listen to with `actor.on`. This is useful for code outside your components, such as keeping a map in step:

```ts
const subscription = manager.actor.on('LAYER.VISIBILITY_CHANGED', ({ layerId, visible }) => {
  console.log(`${layerId} is now ${visible ? 'showing' : 'hidden'}`);
});

// later
subscription.unsubscribe();
```

See the [`@ulm/core` reference](./reference/core#emitted-events) for every emitted event.

## Without the LayerManager class

You can also skip the `LayerManager` class and create the manager machine yourself with `createLayerManagerMachine`. With `@xstate/react`, `createActorContext` provides it to your whole component tree:

```tsx
import { createLayerManagerMachine } from '@ulm/core';
import { createActorContext } from '@xstate/react';

export const LayerManagerContext = createActorContext(createLayerManagerMachine<LayerData>(), {
  input: { allowNestedGroupLayers: false },
});
```

Callbacks and adapters are part of the `LayerManager` class, so in this approach you listen to the manager actor with `actor.on` instead.

## Helper functions

`@ulm/core` also exports helper functions for working with the actors, such as `getTopLevelLayersInOrder` and `getLayerGroupChildrenInOrder`, which turn an order into a list of items. See the [`@ulm/core` reference](./reference/core#helper-functions) for the full list.
