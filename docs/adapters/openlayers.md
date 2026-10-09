# OpenLayers

The `@ulm/openlayers` package connects a layer manager to an [OpenLayers](https://openlayers.org/) map. It adds and removes OpenLayers layers, shows and hides them, sets their opacity, and stacks them in the manager's order. See [Installation](../installation#openlayers) to add it to your project.

## Minimal usage

The simplest approach is to create each OpenLayers layer yourself and keep it in `layerData.openlayersLayer`. The adapter picks it up from there by default.

```ts
import type BaseLayer from 'ol/layer/Base.js';
import { LayerManager } from '@ulm/core';
import { OpenLayersLayerManagerAdapter } from '@ulm/openlayers';
import GeoJSON from 'ol/format/GeoJSON.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import OlMap from 'ol/Map.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import View from 'ol/View.js';

interface LayerData {
  openlayersLayer: BaseLayer;
}

const map = new OlMap({
  target: 'map',
  layers: [new TileLayer({ source: new OSM() })],
  view: new View({ center: [0, 0], zoom: 2 }),
});

const manager = new LayerManager<LayerData>();
manager.setAdapter(new OpenLayersLayerManagerAdapter<LayerData>(map));

manager.addLayer({
  layerConfig: {
    layerId: 'countries',
    layerName: 'Countries',
    layerType: 'layer',
    layerData: {
      openlayersLayer: new VectorLayer({
        source: new VectorSource({
          url: 'https://openlayers.org/en/latest/examples/data/geojson/countries.geojson',
          format: new GeoJSON(),
        }),
      }),
    },
  },
  visible: true,
});
```

## Showing layers with renderLayer

To keep plain settings in `layerData`, such as a URL, give the adapter a `renderLayer` function. It returns the OpenLayers layer to show, or `null` to leave the layer off the map. It runs when a layer is added, and again when its `layerData` or `timeInfo` changes.

Here some layers keep a URL, and the rest keep their OpenLayers layer, which the default shows:

```ts
import type { OpenLayersLayerData } from '@ulm/openlayers';
import { defaultOpenLayersRenderLayer } from '@ulm/openlayers';

type LayerData = { url: string } | OpenLayersLayerData;

manager.setAdapter(
  new OpenLayersLayerManagerAdapter<LayerData>(map, {
    renderLayer(info) {
      if ('url' in info.layerData) {
        return new VectorLayer({ source: new VectorSource({ url: info.layerData.url, format: new GeoJSON() }) });
      }
      return defaultOpenLayersRenderLayer(info);
    },
  }),
);
```

### Keeping the layer already shown

When it runs again, `renderLayer` gets the OpenLayers layer already on the map as `current`. Return it, updated if needed, to keep its features and listeners. Return a new layer to replace it. Here a vector layer takes its stroke colour from `layerData`:

```ts
interface LayerData {
  url: string;
  color: string;
}

manager.setAdapter(
  new OpenLayersLayerManagerAdapter<LayerData>(map, {
    renderLayer(info, _map, current) {
      const style = { 'stroke-color': info.layerData.color, 'stroke-width': 2 };
      if (current instanceof VectorLayer && current.getSource()?.getUrl() === info.layerData.url) {
        current.setStyle(style);
        return current;
      }
      return new VectorLayer({ source: new VectorSource({ url: info.layerData.url, format: new GeoJSON() }), style });
    },
  }),
);
```

The same goes for time. To show the layer's `timeInfo`, pass the time to the source in `renderLayer`, for example as the `TIME` parameter of a WMS source with `updateParams`.

## Settings and data from outside the layer

Put anything else a layer's look depends on, such as a theme or a language, in its `layerData` with `updateLayerData`. `renderLayer` then runs again.

For data you have to fetch, such as the data for a new date, start the fetch in the manager's `onTimeInfoChanged` callback and write the result into `layerData`. Until it arrives, return `current`.

## Cleaning up with disposeLayer

The adapter takes layers off the map but never disposes of them, since you may want to show them again. A layer taken off the map keeps what it holds to draw, such as its canvas and loaded tiles, until you call its `dispose()`. `disposeLayer` runs when the adapter discards a layer `renderLayer` returned: when the layer is removed, when `renderLayer` returns a different one, and when the adapter is detached. Hiding a layer doesn't count. Dispose of layers there if nothing else uses them:

```ts
manager.setAdapter(
  new OpenLayersLayerManagerAdapter<LayerData>(map, {
    renderLayer,
    disposeLayer(openlayersLayer) {
      openlayersLayer.dispose();
    },
  }),
);
```

For other changes, such as opacity, use the `LayerManager` callbacks. See the [`@ulm/openlayers` reference](../reference/openlayers) for every option.

## How stacking works

The adapter adds each layer straight to the map, with no group around them, and keeps them together in the manager's order. Your own layers keep their places: those already on the map stay below the managed layers, and those you add later go above them.

To choose where the managed layers sit, such as between a basemap and its labels, create a [`LayerGroup`](https://openlayers.org/en/latest/apidoc/module-ol_layer_Group-LayerGroup.html), add it to the map, and pass it as the `container` option:

```ts
import LayerGroup from 'ol/layer/Group.js';

const container = new LayerGroup();
map.getLayers().insertAt(1, container);

manager.setAdapter(new OpenLayersLayerManagerAdapter<LayerData>(map, { container }));
```

The adapter doesn't add a group you pass, so add it to the map first. `map.getLayers()` then lists the group rather than the layers in it, so use `map.getAllLayers()` to get every layer. When the adapter is detached, it takes its layers off the map, or out of the group.

OpenLayers draws layers in order of their `zIndex`. Leave `zIndex` unset on the layers you return: they then follow the manager's order. A layer with its own `zIndex` is drawn by that value among every layer on the map, ignoring the manager's order.

## How visibility and opacity work

The adapter calls each layer's `setVisible` and `setOpacity`. A hidden layer stays on the map, switched off, so showing it again is quick. Its opacity is the layer's computed opacity, which replaces any opacity you set on the OpenLayers layer yourself.

OpenLayers fades and hides a layer with the groups it is in. Leave a group you pass as `container` visible and at full opacity, or every managed layer fades or hides with it.

## Things to know

+ Only layers are drawn. Groups have no OpenLayers layer of their own, but hiding or fading a group hides or fades the layers inside it.
+ A `LayerGroup` you return counts as one layer. Its layers keep their own visibility and opacity, combined with what the adapter sets on the group. Set them yourself, in `renderLayer` from values in `layerData`.
+ Each OpenLayers layer can be shown for one layer only. A layer group's layers can't hold the same layer twice, so returning a layer that is already shown throws `Duplicate item added to a unique collection`.
+ `map.setLayers()` and `map.setLayerGroup()` replace every layer on the map, the managed layers included. Add your own layers with `map.addLayer()` instead.
+ If something else, such as a layer switcher, changes a managed layer's visibility or opacity, the manager doesn't know.
