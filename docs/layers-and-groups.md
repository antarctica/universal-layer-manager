# Layers and groups

This page covers how to build up the layer structure of your map: adding and removing layers and groups, nesting groups, and attaching your own data and time information to each layer.

The examples assume a layer manager has already been created, where each layer carries a short note as its data:

```ts
import { LayerManager } from '@ulm/core';

interface LayerData {
  note: string;
}

const manager = new LayerManager<LayerData>();
```

## Adding and removing

### Adding a layer

Add a layer with `addLayer`, giving it a unique `layerId`, a display name and your own `layerData`. Leave out `parentId`, or set it to `null`, to place it at the top level.

```ts
manager.addLayer({
  layerConfig: {
    layerId: 'coastline',
    layerName: 'Coastline',
    layerType: 'layer',
    parentId: null,
    layerData: { note: 'High resolution coastline' },
  },
  visible: true,
});
```

`visible: true` switches on the layer and every group above it, so it shows straight away. Leave it out to add the layer switched off.

`enabled: true` switches on the layer but leaves the groups above it as they are. Use it to restore a saved layer list: a layer that was switched on inside a switched-off group comes back switched on but hidden. See [Visibility and opacity](./visibility-and-opacity) for the difference between switching a layer on and it being visible.

### Adding a group

Groups are added in the same way with `addGroup`, using a `layerType` of `'layerGroup'`.

```ts
manager.addGroup({
  layerConfig: { layerId: 'ocean', layerName: 'Ocean', layerType: 'layerGroup' },
  visible: true,
});
```

### Adding a layer to a group

To put a layer inside a group, set its `parentId` to the group's `layerId`. The group needs to exist first.

```ts
manager.addLayer({
  layerConfig: {
    layerId: 'sea-ice',
    layerName: 'Sea ice',
    layerType: 'layer',
    parentId: 'ocean',
    layerData: { note: 'Daily sea ice extent' },
  },
  visible: true,
});
```

### Choosing where it goes

New layers and groups go to the bottom of their parent by default. Use `position` to add one at the top or bottom, or `index` to add it at an exact place in its parent's order, counting from 0 at the bottom:

```ts
// on top of everything else at the top level
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

// second from the bottom of the ocean group
manager.addLayer({
  layerConfig: {
    layerId: 'bathymetry',
    layerName: 'Bathymetry',
    layerType: 'layer',
    parentId: 'ocean',
    layerData: { note: 'Sea floor depth' },
  },
  index: 1,
});
```

If you give both, `index` wins. An `index` above the number of layers in the parent adds the layer at the top, and a negative `index` adds it at the bottom. See [Ordering and moving](./ordering) for moving layers once they are added.

### Removing a layer or group

Remove a layer or a group by its `layerId`:

```ts
manager.removeLayer('coastline');
```

A group can only be removed once it is empty, so remove the layers inside it first.

## Nested groups

By default, groups can only sit at the top level, which keeps the layer list to a simple, single level. To allow groups inside other groups, turn on `allowNestedGroupLayers` when creating the manager:

```ts
const manager = new LayerManager<LayerData>({ allowNestedGroupLayers: true });

manager.addGroup({
  layerConfig: { layerId: 'forecasts', layerName: 'Forecasts', layerType: 'layerGroup', parentId: 'ocean' },
});
```

## Your own data

Each layer can carry any data you like in `layerData`, and the manager passes it back to you wherever that layer appears. You set its type with the first type parameter of `LayerManager`. Groups can carry their own data too, using the second type parameter, which is `undefined` by default. While a data type allows `undefined`, you can leave `layerData` out, as the group examples above do.

You can read the data back in any callback, and replace it with `updateLayerData`:

```ts
const manager = new LayerManager<LayerData>({
  onLayerAdded(info) {
    console.log(info.layerName, info.layerData);
  },
});

manager.updateLayerData('sea-ice', { note: 'Updated daily at 06:00' });
```

This is a good place for anything the rest of your application needs to know about a layer, such as a map library layer, a legend or an attribution.

## Time info

Layers can optionally carry time information in `timeInfo`, either a single point in time or a range. `precision` says whether the value is a date or a date and time.

Dates are [Temporal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal) values, and each one can be any of these:

| Type | Use it for | Example |
|------|------------|---------|
| `Temporal.PlainDate` | A calendar date | `Temporal.PlainDate.from('2026-06-01')` |
| `Temporal.PlainDateTime` | A date and time, with no time zone | `Temporal.PlainDateTime.from('2026-06-01T06:00')` |
| `Temporal.ZonedDateTime` | A date and time in a time zone | `Temporal.ZonedDateTime.from('2026-06-01T06:00[UTC]')` |

Not every browser supports Temporal yet, so import it from `temporal-polyfill`. See [Dates for time info](./installation#dates-for-time-info) to install it.

```ts
import { Temporal } from 'temporal-polyfill';

manager.addLayer({
  layerConfig: {
    layerId: 'winter-ice',
    layerName: 'Winter sea ice',
    layerType: 'layer',
    parentId: 'ocean',
    layerData: { note: 'Winter average' },
    timeInfo: {
      type: 'range',
      precision: 'date',
      start: Temporal.PlainDate.from('2026-06-01'),
      end: Temporal.PlainDate.from('2026-08-31'),
    },
  },
});
```

Change it later with `setTimeInfo`:

```ts
manager.setTimeInfo('sea-ice', {
  type: 'single',
  precision: 'date',
  value: Temporal.PlainDate.from('2026-10-01'),
});
```

The manager stores the time information and reports changes through `onTimeInfoChanged`. What you do with it, such as showing dates in your layer list or driving a time slider, is up to you.

::: tip
You only need the polyfill until every browser you support has Temporal built in. The manager accepts built-in and polyfilled dates alike, so your layer code stays the same when you drop it.
:::

## Listening for changes

To keep your layer list and the rest of your UI up to date, pass callbacks when creating the manager. Each one is called after the change has been made:

```ts
const manager = new LayerManager<LayerData>({
  onLayerAdded(info) {
    console.log(`added ${info.layerName}`);
  },
  onLayerRemoved(layerId) {
    console.log(`removed ${layerId}`);
  },
  onLayerDataChanged(info) {
    console.log(`${info.layerName} data is now`, info.layerData);
  },
  onTimeInfoChanged(info, timeInfo) {
    console.log(`${info.layerName} now has ${timeInfo.type} time info`);
  },
});
```

Adding the sea ice layer, updating its data, setting a single date and then removing it prints:

```
added Sea ice
Sea ice data is now { note: 'Updated daily at 06:00' }
Sea ice now has single time info
removed sea-ice
```


## Rejections and errors

The manager ignores any change it can't make, such as adding a layer with an ID that is already in use, changing a layer that doesn't exist, or setting an opacity outside 0 to 1. The layers stay as they were, and the manager reports why through the `onError` callback:

```ts
const manager = new LayerManager<LayerData>({
  onError(error) {
    console.warn(error.message);
  },
});
```

For example, removing the `ocean` group above while it still holds `sea-ice` logs:

::: danger Error
Layer group ocean has children. Layer not removed.
:::
