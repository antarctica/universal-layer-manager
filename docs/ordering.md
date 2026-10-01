# Ordering and moving

This page covers how the manager orders layers, where new layers go, and how to move layers within and between groups.

The examples assume a manager with this layer structure. See [Layers and groups](./layers-and-groups) for how to add them. The trees on this page are drawn like a layer list, with the top of the map first, and the number next to each item is its index within its parent.

```
LayerManager
├── ocean (group)    1
│   ├── sea-ice      1
│   └── bathymetry   0
└── coastline        0
```

## Bottom to top

Order works like a stack. The top level and each group keep their own list of the items inside them, ordered from the bottom of the map to the top. Index `0` is the bottom, and each item is drawn on top of the ones before it, so the last item in the list is the top of the map.

The same rule applies everywhere in the library: to `index` when adding and moving layers, to `manager.layers`, and to the order reported by `onOrderChanged`.

::: tip
A layer list usually shows the top of the map first, so reverse each list when you draw it, as the trees on this page do.
:::

## Placing a new layer

New layers and groups go to the bottom of their parent by default. Use `position: 'top'` to add one on top instead, or `index` to add it at an exact place in the order.

```ts
manager.addLayer({
  layerConfig: {
    layerId: 'labels',
    layerName: 'Labels',
    layerType: 'layer',
    parentId: null,
    layerData: { note: 'Place names' },
  },
  position: 'top',
});
```

```
LayerManager
├── labels           2
├── ocean (group)    1
│   ├── sea-ice      1
│   └── bathymetry   0
└── coastline        0
```

See [Choosing where it goes](./layers-and-groups#choosing-where-it-goes) for how `position` and `index` work together.

## Raising and lowering

`raiseLayer` moves a layer or group one step towards the top of its parent, and `lowerLayer` moves it one step towards the bottom. Neither does anything once the layer is already at the top or bottom.

```ts
manager.raiseLayer('bathymetry');
```

```
LayerManager
├── labels           2
├── ocean (group)    1
│   ├── bathymetry   1
│   └── sea-ice      0
└── coastline        0
```

`manager.lowerLayer('bathymetry')` moves it back down again.

## Moving to an index

`moveLayer` moves a layer or group to a new place. Give it the `parentId` to move into, which can be its current parent, and an `index` or `position` within it.

The `index` counts once the layer has left its old place. Here there are three items at the top level, so moving the coastline to index `2` puts it on top:

```ts
manager.moveLayer('coastline', { parentId: null, index: 2 });
```

```
LayerManager
├── coastline        2
├── labels           1
└── ocean (group)    0
    ├── sea-ice      1
    └── bathymetry   0
```

## Moving into a group

To move a layer into a group, set `parentId` to the group's `layerId`:

```ts
manager.moveLayer('coastline', { parentId: 'ocean', position: 'top' });
```

```
LayerManager
├── labels           1
└── ocean (group)    0
    ├── coastline    2
    ├── sea-ice      1
    └── bathymetry   0
```

A `parentId` of `null` moves it back out to the top level:

```ts
manager.moveLayer('coastline', { parentId: null, position: 'bottom' });
```

A moved group takes its layers with it, and a moved layer follows the visibility and opacity of its new group.

## Listening for changes

Two callbacks report changes to the order:

+ `onOrderChanged` receives the whole order, flattened into a single list of IDs from bottom to top, with each group followed by its own layers.
+ `onLayerMoved` receives the moved layer's details after each move, raise or lower, with `info.parentId` set to its new parent.

```ts
const manager = new LayerManager<LayerData>({
  onOrderChanged(layerOrder) {
    console.log(layerOrder);
  },
  onLayerMoved(info) {
    console.log(`moved ${info.layerName}, now in ${info.parentId ?? 'the top level'}`);
  },
});
```

Moving the coastline into the ocean group, as above, prints:

```
[ 'ocean', 'bathymetry', 'sea-ice', 'coastline', 'labels' ]
moved Coastline, now in ocean
```

Adapters receive the same order, which is how the [Leaflet adapter](./adapters/leaflet) restacks the map.

## Rejections

A move is rejected when the layer or the target group doesn't exist, the target isn't a group, a group is moved into itself or a group inside it, or a group is moved into another group without `allowNestedGroupLayers`. The order stays as it was, and the reason is reported through `onError`. For example, `labels` is a layer rather than a group, so `manager.moveLayer('coastline', { parentId: 'labels' })` reports:

::: danger Error
Unable to find parent group labels. Layer coastline not moved.
:::
