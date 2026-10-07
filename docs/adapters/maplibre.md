# MapLibre

The `@ulm/maplibre` package connects a layer manager to a [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) map. It adds and removes each layer's sources and style layers, shows and hides them, sets their opacity, and stacks them in the manager's order below the basemap's labels. See [Installation](../installation#maplibre) to add it to your project.

## Minimal usage

The simplest approach is to keep each layer's MapLibre style in `layerData`: the sources it reads, and its style layers from the bottom up. The adapter shows it from there by default.

```ts
import type { MapLibreLayerStyle } from '@ulm/maplibre';
import { LayerManager } from '@ulm/core';
import { MapLibreLayerManagerAdapter } from '@ulm/maplibre';
import * as maplibregl from 'maplibre-gl';

type LayerData = MapLibreLayerStyle;

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/bright',
  center: [-0.1, 51.505],
  zoom: 10,
});

const manager = new LayerManager<LayerData>();
manager.setAdapter(new MapLibreLayerManagerAdapter<LayerData>(map));

manager.addLayer({
  layerConfig: {
    layerId: 'railways',
    layerName: 'Railways',
    layerType: 'layer',
    layerData: {
      sources: { railways: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
      layers: [{
        'id': 'railways',
        'type': 'line',
        'source': 'railways',
        'source-layer': 'transportation',
        'filter': ['==', ['get', 'class'], 'rail'],
        'paint': { 'line-color': '#e65100', 'line-width': 2 },
      }],
    },
  },
  visible: true,
});
```

You can attach the adapter as soon as the map is created. It waits for the style to load before it shows anything.

## Showing layers with renderLayer

To keep other data in `layerData`, such as a URL, give the adapter a `renderLayer` function. It returns the sources and style layers to show, or `null` to leave the layer off the map. It runs when a layer is added, and again when its `layerData` or `timeInfo` changes.

Here some layers keep a GeoJSON URL, and the rest keep a style, which the default shows:

```ts
import type { MapLibreLayerStyle } from '@ulm/maplibre';
import { defaultMapLibreRenderLayer } from '@ulm/maplibre';

type LayerData = { url: string } | MapLibreLayerStyle;

manager.setAdapter(
  new MapLibreLayerManagerAdapter<LayerData>(map, {
    renderLayer(info) {
      if ('url' in info.layerData) {
        return {
          sources: { [info.layerId]: { type: 'geojson', data: info.layerData.url } },
          layers: [{ id: info.layerId, type: 'line', source: info.layerId }],
        };
      }
      return defaultMapLibreRenderLayer(info);
    },
  }),
);
```

### Updating the style already shown

When it runs again, `renderLayer` gets the style it returned last time as `current`. The adapter changes only what differs: new GeoJSON data goes through `setData`, and new tile URLs through `setTiles` or `setUrl`, without flickering. Return `current` to leave the map alone. Here a layer's tiles come from its date:

```ts
manager.setAdapter(
  new MapLibreLayerManagerAdapter<LayerData>(map, {
    renderLayer(info) {
      const date = isSingleTimeInfo(info.timeInfo) ? info.timeInfo.value.toString() : 'latest';
      return {
        sources: { 'sea-ice': { type: 'raster', tiles: [`https://example.com/sea-ice/${date}/{z}/{x}/{y}.png`], tileSize: 256 } },
        layers: [{ id: 'sea-ice', type: 'raster', source: 'sea-ice' }],
      };
    },
  }),
);
```

## Settings and data from outside the layer

Put anything else a layer's look depends on, such as a theme or a language, in its `layerData` with `updateLayerData`. `renderLayer` then runs again.

For data you have to fetch, such as the data for a new date, start the fetch in the manager's `onTimeInfoChanged` callback and write the result into `layerData`. Until it arrives, return `current`.

## Cleaning up with disposeLayer

`disposeLayer` undoes anything you set up outside the style. It runs when the adapter discards a style `renderLayer` returned: when the layer is removed, when `renderLayer` returns a different style, and when the adapter is detached. Hiding a layer, or new GeoJSON data or tile URLs, don't count.

For other changes, such as opacity, use the `LayerManager` callbacks. See the [`@ulm/maplibre` reference](../reference/maplibre) for every option.

## Sources and style layer IDs

Sources and style layers keep the IDs `renderLayer` gives them, so you can use them with the map directly:

```ts
map.on('click', 'sea-ice', (event) => {
  console.log(event.features);
});
```

+ A listener like this keeps working when its style layer is removed and comes back.
+ Give each style layer its own ID. Include `info.layerId` when more than one layer would otherwise use the same one, such as `line`.
+ If the map already has an ID you gave, such as from the basemap, the adapter leaves the layer off the map and reports a MapLibre `error` event.
+ Layers that list the same source share it.
+ To read a basemap source, name it in a style layer and leave it out of `sources`.

## How stacking works

The adapter draws your layers in one block, in the manager's order, directly below the basemap's first label layer. So they sit above the land, water and roads, and below the labels. With no labels, they go on top.

To place them somewhere else, name the style layer to draw below. On OpenFreeMap Bright, this puts them below the roads:

```ts
manager.setAdapter(new MapLibreLayerManagerAdapter<LayerData>(map, { drawBelow: 'tunnel-service-track-casing' }));
```

A hidden layer stays in the style, with its `visibility` set to `none`.

## How opacity works

MapLibre can fade a whole fill or line layer, so the adapter sets their `fill-layer-opacity` or `line-layer-opacity`. The style's own `fill-opacity` and `line-opacity` still apply on top.

Other kinds of style layer have no whole-layer opacity, so the adapter scales their own opacity instead, such as `raster-opacity` or `circle-opacity`. Hillshade layers have no opacity, so they can't be faded.

## Switching the basemap

In MapLibre the basemap is the map's style, not a layer in the manager. Switch it with `map.setStyle`, and the adapter adds your layers back once the new style has loaded.

```ts
map.setStyle('https://tiles.openfreemap.org/styles/dark');
```

## Things to know

+ Only layers are drawn. Groups have no style layers of their own, but hiding or fading a group hides or fades the layers inside it.
+ Custom layers, which draw with their own WebGL code, are not supported. Add them to the map yourself.
+ Provide images, such as icons and fill patterns, with `map.setMissingStyleImageResolver`. Images added with `map.addImage` are lost when the basemap changes.
+ Reject an invalid date before calling `setTimeInfo`, so the map always shows the time the manager holds.
