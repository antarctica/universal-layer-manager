# Leaflet

The `@ulm/leaflet` package connects a layer manager to a [Leaflet](https://leafletjs.com/) map. It adds and removes Leaflet layers, shows and hides them, sets their opacity, and stacks them in the manager's order. See [Installation](../installation#leaflet) to add it to your project.

## Minimal usage

The simplest approach is to create each Leaflet layer yourself and keep it in `layerData.leafletLayer`. The adapter picks it up from there by default.

```ts
import { LayerManager } from '@ulm/core';
import { LeafletLayerManagerAdapter } from '@ulm/leaflet';
import * as L from 'leaflet';

interface LayerData {
  leafletLayer: L.Layer;
}

const map = L.map('map').setView([51.505, -0.09], 13);

const manager = new LayerManager<LayerData>();
manager.setAdapter(new LeafletLayerManagerAdapter<LayerData>(map));

manager.addLayer({
  layerConfig: {
    layerId: 'osm',
    layerName: 'OpenStreetMap',
    layerType: 'layer',
    parentId: null,
    layerData: { leafletLayer: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png') },
  },
  visible: true,
});
```

## Creating layers with a factory

If you'd rather keep plain settings in `layerData`, such as a URL, give the adapter a `layerFactory`. It is called for each layer added, and again whenever a layer's data is replaced. It returns the Leaflet layer to use, or `null` to leave that layer off the map.

```ts
interface LayerData {
  url: string;
}

manager.setAdapter(
  new LeafletLayerManagerAdapter<LayerData>(map, {
    layerFactory(info) {
      return L.tileLayer(info.layerData.url);
    },
  }),
);
```

### When a layer's data changes

When you replace a layer's data with `updateLayerData`, the adapter calls the factory again. This time it also passes the Leaflet layer it already drew, as `current`. If the factory returns that same layer, the map is left alone. If it returns a different one, the adapter draws the new layer in place of the old one, in the same place in the order, at the same opacity and visibility.

So a factory can update the layer it already has, instead of building a new one. Here each layer is a WMS layer, and `layerData` holds its settings. Changing `layers` or `styles` asks the same Leaflet layer for new images, so its popups, tooltips and event handlers stay in place. Leaflet only reads a layer's attribution when the layer is added to the map, so a new `attribution` builds a new layer instead:

```ts
interface LayerData {
  url: string;
  layers: string;
  styles: string;
  attribution: string;
}

manager.setAdapter(
  new LeafletLayerManagerAdapter<LayerData>(map, {
    layerFactory(info, _map, current) {
      const { url, layers, styles, attribution } = info.layerData;
      if (current instanceof L.TileLayer.WMS && current.options.attribution === attribution) {
        return current.setParams({ layers, styles });
      }
      return L.tileLayer.wms(url, { layers, styles, attribution });
    },
  }),
);
```

`setParams` returns the same layer, so the adapter leaves it in place. A new layer is drawn in place of the old one, and Leaflet's attribution control shows its attribution.

If you keep the Leaflet layer itself in `layerData`, as in the first example, there is nothing to do: changing other data keeps the same Leaflet layer, so the map is left alone.

## Running your own code with hooks

To do more with a Leaflet layer after the adapter has updated it, pass `hooks`. Each hook receives the layer's info and its Leaflet layer. For example, to give every layer a tooltip with its name when it is created:

```ts
manager.setAdapter(
  new LeafletLayerManagerAdapter<LayerData>(map, {
    hooks: {
      onLayerAdded(info, leafletLayer) {
        leafletLayer.bindTooltip(info.layerName);
      },
    },
  }),
);
```

The adapter doesn't change the map when a layer's time changes, because what time means depends on your data. Use the `onTimeInfoChanged` hook to apply it. For example, to send a WMS layer's date as its `TIME` parameter:

```ts
manager.setAdapter(
  new LeafletLayerManagerAdapter<LayerData>(map, {
    hooks: {
      onTimeInfoChanged(_info, timeInfo, leafletLayer) {
        if (leafletLayer instanceof L.TileLayer.WMS && isSingleTimeInfo(timeInfo)) {
          const params = { ...leafletLayer.wmsParams, time: timeInfo.value.toString() };
          leafletLayer.setParams(params);
        }
      },
    },
  }),
);
```

See the [`@ulm/leaflet` reference](../reference/leaflet) for every hook.

## How stacking works

Leaflet normally stacks layers by kind, using its built-in panes: tile layers at the bottom, then vectors, then markers. The adapter replaces this with the manager's order, so any kind of layer can sit above any other. A tile layer can be drawn above a polygon, for example, or a marker below a tile layer.

To do this, the adapter draws each layer in its own [pane](https://leafletjs.com/reference.html#map-pane), named `ulm-<layerId>`, and sets each pane's `z-index` whenever the order changes. All of these panes sit inside one container pane, `ulmPane`, at `z-index` 450. That places it above Leaflet's overlay pane (400) and below its shadow, marker, tooltip and popup panes (500 to 700). Popups, tooltips and markers you add outside the manager stay on top.

When a layer is removed, its pane is removed with it. When the adapter is detached, it removes the container pane and every pane inside it.

## How opacity works

Opacity is applied to each layer's pane, using the layer's computed opacity. This works the same way for every kind of layer, including markers and vectors such as circles. The adapter doesn't change the layer's own style, so settings such as a polygon's `fillOpacity` still apply on top.

## Things to know

+ Only layers are drawn. Groups have no Leaflet layer of their own, but hiding or fading a group hides or fades the layers inside it.
+ The adapter sets each layer's `pane` option, replacing any pane you set yourself. It also sets `shadowPane` on markers, and the pane of every layer inside an `L.LayerGroup`, such as an `L.GeoJSON`.
+ With `preferCanvas: true`, each vector layer gets its own canvas, and only the top one receives mouse events. Use Leaflet's default SVG renderer if you need to click on overlapping vector layers.
