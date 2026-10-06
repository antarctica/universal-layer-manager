# Working with XState

The `LayerManager` class is built on [XState](https://stately.ai/docs/xstate) state machines, and XState is installed as a dependency of `@ulm/core`. If you want more direct control, you can work with the underlying actors yourself.

## Why work with the actors?

`LayerManager`, its callbacks and adapters suit most uses: you make changes through one object and react to the results in one place.

Working with the actors directly is useful when parts of your application care about single layers. Every layer and group is its own actor, so code can subscribe to just the actor it needs and send events straight to it. A legend for one layer subscribes to that layer's actor, and hears only about that layer.

## The actors

There are three kinds of actor:

+ The **manager actor** holds the whole layer tree. Its context includes `layers`, every layer and group in the manager, and `childLayerOrder`, the order of the top-level items. Get it from `manager.actor`.
+ A **layer actor** holds one layer. Its context includes `layerName`, `layerData`, `opacity` and `timeInfo`.
+ A **group actor** holds one group. As well as the fields a layer has, its context includes `children` and `childLayerOrder`, which the manager sets.

Each item in the manager's `layers` has a `type`, either `'layer'` or `'layerGroup'`, and a `layerActor`. The actor's `id` is the item's `layerId`.

Use the `enabled` and `visible` tags to check a layer's state. They mean the same as [enabled and visible](./visibility-and-opacity#enabled-and-visible) elsewhere in the library.

## Reading an actor

Find a layer's actor in the manager's `layers`, then read it with `getSnapshot` or subscribe to it. Check the item's `type` first, so TypeScript knows which kind of actor it is:

```ts
import { findManagedLayerById } from '@ulm/core';

const item = findManagedLayerById(manager.actor.getSnapshot().context.layers, 'sea-ice');

if (item?.type === 'layer') {
  const snapshot = item.layerActor.getSnapshot();
  console.log(snapshot.context.opacity, snapshot.hasTag('visible'));

  // called each time this layer changes, and only this layer
  const subscription = item.layerActor.subscribe((snapshot) => {
    console.log(`${snapshot.context.layerName} is ${snapshot.hasTag('visible') ? 'showing' : 'hidden'}`);
  });

  // later
  subscription.unsubscribe();
}
```

## Sending events

`LayerManager` methods are a thin layer over events sent to the actors. You can send these events yourself:

```ts
item.layerActor.send({ type: 'LAYER.SET_OPACITY', opacity: 0.5 });
```

To a layer or group actor:

| Event | Does the same as |
|---|---|
| `{ type: 'LAYER.ENABLED' }` / `{ type: 'LAYER.DISABLED' }` | `setEnabled` |
| `{ type: 'LAYER.SHOW' }` | `showLayer` |
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

The manager actor emits an event for every change, which you can listen to with `actor.on`:

```ts
const subscription = manager.actor.on('LAYER.VISIBILITY_CHANGED', ({ layerId, visible }) => {
  console.log(`${layerId} is now ${visible ? 'showing' : 'hidden'}`);
});

// later
subscription.unsubscribe();
```

See the [`@ulm/core` reference](./reference/core#emitted-events) for every emitted event.

## Without the LayerManager class

You can also skip the `LayerManager` class and run the manager machine yourself. Create it with `createLayerManagerMachine`, and start it with XState's `createActor`, after installing `xstate`:

```ts
import { connectAdapter, createLayerManagerMachine, createLayerTreeReader } from '@ulm/core';
import { createActor } from 'xstate';

const managerActor = createActor(createLayerManagerMachine<LayerData, undefined>(), {
  input: { allowNestedGroupLayers: false },
}).start();

// draw the layers on a map, and disconnect the adapter again later
const disconnect = connectAdapter(managerActor, new LeafletLayerManagerAdapter<LayerData>(map));

// change layers by sending events
managerActor.send({ type: 'LAYER.ADD', params: { layerConfig, visible: true } });

// rejections, which the class would report through onError
managerActor.on('LAYER.REJECTED', ({ reason }) => console.warn(reason));

// the layer tree, as LayerManager.getTree() returns it
const getTree = createLayerTreeReader(managerActor);
managerActor.subscribe(() => render(getTree()));
```

`connectAdapter` tells the adapter about the layers the manager already holds, reports every change after that, and returns a function that disconnects it.

## In React

[`@xstate/react`](https://stately.ai/docs/xstate-react) works with these actors as with any other. `createActorContext` starts the manager machine for a component tree, and `useSelector` reads one actor, so a component renders again only when the values it selects change:

```tsx
import type { LayerActor } from '@ulm/core';
import { createLayerManagerMachine } from '@ulm/core';
import { createActorContext, useSelector } from '@xstate/react';

const LayerManagerContext = createActorContext(createLayerManagerMachine<LayerData, undefined>(), {
  input: { allowNestedGroupLayers: false },
});

// renders again only when this layer's name or visibility changes
function LayerName({ actor }: { actor: LayerActor<LayerData> }) {
  const name = useSelector(actor, (state) => state.context.layerName);
  const visible = useSelector(actor, (state) => state.hasTag('visible'));
  return <li>{visible ? name : `${name} (hidden)`}</li>;
}

function LayerNames() {
  const layers = LayerManagerContext.useSelector((state) => state.context.layers);
  return <ul>{layers.map(({ layerActor }) => <LayerName key={layerActor.id} actor={layerActor} />)}</ul>;
}

function App() {
  return (
    <LayerManagerContext.Provider>
      <LayerNames />
    </LayerManagerContext.Provider>
  );
}
```

The [Leaflet and React with XState example](./examples#leaflet-and-react-with-xstate-advanced) builds a full layer list that way, including groups and drag-and-drop reordering.

## Helper functions

`@ulm/core` also exports helper functions for working with the actors, such as `findManagedLayerById` and `getTopLevelLayersInOrder`. See the [`@ulm/core` reference](./reference/core#helper-functions) for the full list.
