# ArcGIS

The `@ulm/arcgis` package connects a layer manager to a map from the [ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/latest/). It adds and removes ArcGIS layers, shows and hides them, sets their opacity, and stacks them in the manager's order. See [Installation](../installation#arcgis) to add it to your project.

## Minimal usage

The simplest approach is to create each ArcGIS layer yourself and keep it in `layerData.arcgisLayer`. The adapter picks it up from there by default.

```ts
import type Layer from '@arcgis/core/layers/Layer.js';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import EsriMap from '@arcgis/core/Map.js';
import MapView from '@arcgis/core/views/MapView.js';
import { ArcGISLayerManagerAdapter } from '@ulm/arcgis';
import { LayerManager } from '@ulm/core';

interface LayerData {
  arcgisLayer: Layer;
}

const map = new EsriMap();
const view = new MapView({ container: 'map', map, center: [-118.805, 34.02], zoom: 13 });

const manager = new LayerManager<LayerData>();
manager.setAdapter(new ArcGISLayerManagerAdapter<LayerData>(map));

manager.addLayer({
  layerConfig: {
    layerId: 'trailheads',
    layerName: 'Trailheads',
    layerType: 'layer',
    layerData: {
      arcgisLayer: new FeatureLayer({
        url: 'https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trailheads/FeatureServer/0',
      }),
    },
  },
  visible: true,
});
```

The adapter works on the `Map`, not the view, so the same code serves a `MapView` and a `SceneView`. With the `<arcgis-map>` component, pass its `map` once `viewOnReady()` resolves.

## Showing layers with renderLayer

To keep plain settings in `layerData`, such as a URL, give the adapter a `renderLayer` function. It returns the ArcGIS layer to show, or `null` to leave the layer off the map. It runs when a layer is added, and again when its `layerData` or `timeInfo` changes.

Here some layers keep a URL, and the rest keep their ArcGIS layer, which the default shows:

```ts
import type { ArcGISLayerData } from '@ulm/arcgis';
import { defaultArcGISRenderLayer } from '@ulm/arcgis';

type LayerData = { url: string } | ArcGISLayerData;

manager.setAdapter(
  new ArcGISLayerManagerAdapter<LayerData>(map, {
    renderLayer(info) {
      if ('url' in info.layerData) {
        return new FeatureLayer({ url: info.layerData.url });
      }
      return defaultArcGISRenderLayer(info);
    },
  }),
);
```

### Keeping the layer already shown

When it runs again, `renderLayer` gets the ArcGIS layer already on the map as `current`. Return it, updated if needed, to keep its features, popups and handlers. Return a new layer to replace it. Here a feature layer takes its filter from `layerData`:

```ts
interface LayerData {
  url: string;
  where: string;
}

manager.setAdapter(
  new ArcGISLayerManagerAdapter<LayerData>(map, {
    renderLayer(info, _map, current) {
      if (current instanceof FeatureLayer && current.url === info.layerData.url) {
        current.definitionExpression = info.layerData.where;
        return current;
      }
      return new FeatureLayer({ url: info.layerData.url, definitionExpression: info.layerData.where });
    },
  }),
);
```

The same goes for time. To show the layer's `timeInfo`, set the layer's `timeExtent` in `renderLayer`, with `useViewTime` set to `false` so the view's time doesn't narrow it.

## Settings and data from outside the layer

Put anything else a layer's look depends on, such as a theme or a language, in its `layerData` with `updateLayerData`. `renderLayer` then runs again.

For data you have to fetch, such as the data for a new date, start the fetch in the manager's `onTimeInfoChanged` callback and write the result into `layerData`. Until it arrives, return `current`.

## Cleaning up with disposeLayer

The adapter takes layers off the map but never destroys them, since you may want to show them again. `disposeLayer` runs when the adapter discards a layer `renderLayer` returned: when the layer is removed, when `renderLayer` returns a different one, and when the adapter is detached. Hiding a layer doesn't count. Destroy layers there if nothing else uses them:

```ts
manager.setAdapter(
  new ArcGISLayerManagerAdapter<LayerData>(map, {
    renderLayer,
    disposeLayer(arcgisLayer) {
      arcgisLayer.destroy();
    },
  }),
);
```

For other changes, such as opacity, use the `LayerManager` callbacks. See the [`@ulm/arcgis` reference](../reference/arcgis) for every option.

## How stacking works

The adapter adds each layer straight to `map.layers`, with no group around them, so ArcGIS components such as the Legend see them as ordinary layers. It keeps them together in the manager's order. Layers you add to the map yourself keep their places: those already on the map stay below the managed layers, and those you add later go above them. Basemap layers are drawn apart from `map.layers`, so they stay below, and reference layers stay above.

To keep the managed layers inside a group, such as one for each of several managers, create a [`GroupLayer`](https://developers.arcgis.com/javascript/latest/references/core/layers/GroupLayer/), add it to the map, and pass it as the `container` option:

```ts
import GroupLayer from '@arcgis/core/layers/GroupLayer.js';

const container = new GroupLayer();
map.add(container);

manager.setAdapter(new ArcGISLayerManagerAdapter<LayerData>(map, { container }));
```

The adapter doesn't add a group you pass to the map, so add it first. When the adapter is detached, it takes its layers off the map, or out of the group.

In a `SceneView`, ArcGIS draws tiled layers before other layers, whatever their order, so the order applies within each kind.

## How visibility and opacity work

The adapter sets each layer's `visible` and `opacity`. A hidden layer stays on the map with `visible` set to `false`, so showing it again is quick. Its `opacity` is the layer's computed opacity, which replaces any opacity you set on the ArcGIS layer yourself.

## Things to know

+ Only layers are drawn. Groups have no ArcGIS layer of their own, but hiding or fading a group hides or fades the layers inside it.
+ A `GroupLayer`, `SubtypeGroupLayer` or `MapImageLayer` you return counts as one layer. Set the visibility of its sublayers yourself, in `renderLayer` from values in `layerData`.
+ The `arcgis-layer-list` component shows the managed layers too, and changes their `visible` without telling the manager. Use your own layer list, driven by the manager, and set `listMode: 'hide'` on the layers you return to keep them out of it. If something else changes a managed layer's `visible` or `opacity`, the manager doesn't know.
