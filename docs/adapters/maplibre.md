# MapLibre

The `@ulm/maplibre` package connects a layer manager to a [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) map. It adds and removes each layer's sources and style layers, shows and hides them, sets their opacity, and stacks them in the manager's order below the basemap's labels. See [Installation](../installation#maplibre) to add it to your project.

## Minimal usage

The simplest approach is to keep each layer's MapLibre style in `layerData`: the sources it reads, and its style layers from the bottom up. The adapter draws it from there by default.

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
      sources: { openfreemap: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
      layers: [{
        'id': 'rails',
        'type': 'line',
        'source': 'openfreemap',
        'source-layer': 'transportation',
        'filter': ['==', ['get', 'class'], 'rail'],
        'paint': { 'line-color': '#e65100', 'line-width': 2 },
      }],
    },
  },
  visible: true,
});
```

You can attach the adapter as soon as the map is created. It waits for the style to load before it draws.

## Creating styles with a factory

If you'd rather keep other data in `layerData`, such as a URL, give the adapter a `layerFactory`. It is called for each layer added, and again whenever a layer's data is replaced. It returns the sources and style layers to draw, or `null` to leave that layer off the map.

```ts
interface LayerData {
  url: string;
}

manager.setAdapter(
  new MapLibreLayerManagerAdapter<LayerData>(map, {
    layerFactory(info) {
      return {
        sources: { [info.layerId]: { type: 'geojson', data: info.layerData.url } },
        layers: [{ id: 'line', type: 'line', source: info.layerId }],
      };
    },
  }),
);
```

To handle some layers yourself and leave the rest to the default, call `createDefaultMapLibreFactory()` from your own factory.

### When a layer's data changes

When you replace a layer's data with `updateLayerData`, the adapter calls the factory again and draws the new style in the layer's place. New GeoJSON data is applied with `setData`, and new tile URLs with `setTiles` or `setUrl`, so the map updates without flickering. Sources that haven't changed are kept as they are.

## Running your own code

The adapter has no hooks of its own. To run code when a layer changes, pass callbacks such as `onLayerAdded` or `onOpacityChanged` to the `LayerManager`.

The adapter doesn't change the map when a layer's time changes, because what time means depends on your data. Use the manager's `onTimeInfoChanged` callback to apply it. For example, to show a raster layer's imagery for its date, replace its data with a new tile URL:

```ts
const manager = new LayerManager<LayerData>({
  onTimeInfoChanged(info, timeInfo) {
    if (isSingleTimeInfo(timeInfo)) {
      manager.updateLayerData(info.layerId, seaIce(timeInfo.value.toString()));
    }
  },
});
```

Here `seaIce(date)` returns the layer's style, with the date in its tile URL. The old image stays on screen until the new one loads.

## How stacking works

The adapter draws every layer in one block, in the manager's order, directly below the basemap's first label layer. So your layers sit above the basemap's land, water and roads, and below its labels. If the basemap has no labels, they go on top.

To place them somewhere else, name the style layer to draw below. On OpenFreeMap Bright, this puts them below the roads:

```ts
manager.setAdapter(new MapLibreLayerManagerAdapter<LayerData>(map, { drawBelow: 'tunnel-service-track-casing' }));
```

A hidden layer stays in the style, with its `visibility` set to `none`.

## How opacity works

MapLibre can fade a whole fill or line layer, so the adapter sets their `fill-layer-opacity` or `line-layer-opacity`. The style's own `fill-opacity` and `line-opacity` still apply on top.

Other kinds of style layer have no whole-layer opacity, so the adapter scales their own opacity instead, such as `raster-opacity` or `circle-opacity`. Hillshade layers have no opacity, so they can't be faded.

## Switching the basemap

In MapLibre, the basemap is the map's style, so it isn't a layer in the manager. Switch it with `map.setStyle`. Once the new style has loaded, the adapter adds your layers back below its labels, as they were.

```ts
map.setStyle('https://tiles.openfreemap.org/styles/dark');
```

## Things to know

+ Only layers are drawn. Groups have no style layers of their own, but hiding or fading a group hides or fades the layers inside it.
+ Layers that name the same source share it, so its data loads once. It keeps the settings it was first added with, and is removed with the last layer that reads it.
+ The adapter adds each source as `ulm:<sourceId>` and each style layer as `ulm:<layerId>:<styleLayerId>`, such as `ulm:railways:rails`. Use these IDs to work with the map directly, for example in `map.on('click', 'ulm:railways:rails', …)`.
+ Custom layers, which draw with their own WebGL code, are not supported. Add them to the map yourself.
+ Images that style layers use, such as icons and fill patterns, are yours to add with `map.addImage`.
