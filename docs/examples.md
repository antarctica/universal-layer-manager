# Examples

The repository includes two example applications. Each takes a different approach to building a user interface on top of the layer manager, so they are useful starting points for your own. To run them locally, see [From a local clone](./installation#from-a-local-clone).

## Simple: vanilla TypeScript

[Live demo](https://antarctica.github.io/universal-layer-manager/examples/simple/) · [Source](https://github.com/antarctica/universal-layer-manager/tree/main/examples/simple)

A layer list built with plain DOM code, with no framework and no map. You can add layers and groups, switch them on and off, and change their opacity.

### The approach

The whole list is drawn from the manager's layer tree. The list subscribes to the manager, and `render` reads `getTree()`, throws the old list away and draws it again:

```ts
const manager = new LayerManager<undefined>({ allowNestedGroupLayers: true });
manager.subscribe(render);

function render() {
  const { rootIds, layers } = manager.getTree();
  list.replaceChildren(...renderLayers(rootIds, layers));
}
```

The list never keeps its own copy of the layer state. Its checkboxes and sliders call manager methods such as `setEnabled` and `setOpacity`, and the subscription then redraws the list with the result. Redrawing everything keeps the code simple and is fast enough for a short list. For long lists, subscribe to each layer instead, as the Leaflet example does.

## Leaflet and React

[Live demo](https://antarctica.github.io/universal-layer-manager/examples/leaflet/) · [Source](https://github.com/antarctica/universal-layer-manager/tree/main/examples/leaflet)

A React layer list alongside a Leaflet map, with nested groups, tile layers, circles and a marker. Layers can be switched on and off, faded, and reordered by drag and drop, and the map follows every change.

### The approach

A single `LayerManager` is created once and shared through React context. The layer list and the map are separate components that never talk to each other directly. Both work through the manager:

+ The **map** attaches the Leaflet adapter and adds the initial layers. From then on, the adapter keeps the map in step.
+ The **layer list** subscribes to the actors with `@xstate/react`, as described in [Working with XState](./xstate). Each row subscribes to its own layer's actor and sends events straight to it.

### Worth a closer look

+ **Setting up in an effect.** The map calls `manager.reset()` before setting up its layers. React runs effects twice in development, and without the reset the second run's layers would be rejected as duplicates.
+ **Drag and drop.** `useLayerDragAndDrop.ts` turns a drop in a top-first list into a `moveLayer` call, which counts from the bottom and from after the layer has left its old place.
+ **Invalid moves.** The list doesn't try to prevent drops such as a group into itself. It leaves the manager to reject them, and logs the reason from `onError`.
