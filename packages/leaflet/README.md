# @ulm/leaflet

Leaflet adapter for [@ulm/core](../core/README.md). `LayerManager` calls the adapter as layers change, and the adapter adds, removes, shows, hides and fades the matching Leaflet layers.

## Installation

```bash
npm install @ulm/core @ulm/leaflet leaflet
```

## Minimal usage

Create a `LayerManager`, create a Leaflet map, then create the adapter and attach it with `setAdapter`. The adapter then keeps the map in step with the manager.

```ts
import { LayerManager } from '@ulm/core';
import { LeafletLayerManagerAdapter } from '@ulm/leaflet';
import * as L from 'leaflet';

// Store the Leaflet layer in layerData.leafletLayer for minimal config
interface LayerData {
  leafletLayer: L.Layer;
}

const map = L.map('map').setView([51.5, -0.09], 13);

const manager = new LayerManager<LayerData>();
manager.setAdapter(new LeafletLayerManagerAdapter(map));

// Add a layer (layerData.leafletLayer is used by the default factory)
manager.addLayer({
  layerConfig: {
    layerId: 'basemap',
    layerName: 'Basemap',
    layerType: 'layer',
    parentId: null,
    layerData: {
      leafletLayer: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
    },
  },
  visible: true,
});

// On teardown
manager.destroy(); // calls adapter.unregister() internally
```

## Customisation

### Layer factory

Provide a `layerFactory` to create Leaflet layers from config (e.g. tile URL, GeoJSON) instead of storing a pre-created layer in `layerData`:

```ts
interface LayerData {
  url: string;
  options?: L.TileLayerOptions;
}

manager.setAdapter(
  new LeafletLayerManagerAdapter<LayerData>(map, {
    layerFactory(info, _map) {
      return L.tileLayer(info.layerData.url, info.layerData.options);
    },
  }),
);
```

### Hooks

Use `hooks` to run extra logic after the adapter has updated a Leaflet layer (for example custom styling for a "ship-track" layer):

```ts
manager.setAdapter(
  new LeafletLayerManagerAdapter(map, {
    hooks: {
      onVisibilityChanged(info, visible, leafletLayer) {
        if (info.layerData.kind === 'ship-track') {
          (leafletLayer as L.GeoJSON).setStyle({
            opacity: visible ? 1 : 0.2,
          });
        }
      },
    },
  }),
);
```

## API

### `new LeafletLayerManagerAdapter<TLayer, TGroup>(map, options?)`

Implements `LayerManagerAdapter`. Attach it with `manager.setAdapter(adapter)`. `TLayer` is your layer `layerData` type and `TGroup` your group data type (defaults to `TLayer`).

**Options** (all optional):

| Option | Type | Description |
|--------|------|-------------|
| `layerFactory` | `(info, map) => L.Layer \| null` | Creates the Leaflet layer for a newly added layer. Return `null` to leave that layer off the map. Defaults to `createDefaultLeafletFactory()` |
| `hooks` | `LeafletAdapterHooks` | Extra logic that runs after the adapter has updated a Leaflet layer (see below) |

**Hooks** (all optional; each runs only for layers that have a Leaflet layer):

| Hook | Called after |
|------|--------------|
| `onLayerAdded(info, leafletLayer)` | A layer is created, and added to the map if it is visible |
| `onLayerRemoved(layerId, leafletLayer)` | A layer is removed from the map |
| `onVisibilityChanged(info, visible, leafletLayer)` | A layer is added to or removed from the map |
| `onOpacityChanged(info, opacity, computedOpacity, leafletLayer)` | A layer's computed opacity changes, after its pane is faded |
| `onLayerDataChanged(info, leafletLayer)` | A layer's `layerData` is replaced |

**Methods:**

| Method | Description |
|--------|-------------|
| `getContext()` | Returns the Leaflet map |
| `register(manager, callbacks)` | Called by `LayerManager` when the adapter is attached |
| `unregister()` | Called by `LayerManager` on `setAdapter(null)`, when another adapter replaces it, or on `destroy()`. Removes every managed layer from the map |
| `onLayerAdded(info)`, `onLayerRemoved(layerId)`, `onVisibilityChanged(info, visible)`, `onOpacityChanged(info, computedOpacity)`, `onLayerDataChanged(info)`, `onOrderChanged(layerOrder)` | Called by `LayerManager` as layers change; you do not call these yourself |

### `createDefaultLeafletFactory<TLayer>()`

Returns the default factory: it uses `layerData.leafletLayer` when present, and otherwise returns `null`.

### Behaviour notes

- Only layers are drawn. Groups have no Leaflet layer; hiding a group hides its layers.
- Opacity is applied as the CSS `opacity` of the layer's pane (see below), set to the computed opacity when the layer is added and each time it changes. This works for every kind of layer, including paths such as circles. The adapter does not call the layer's own `setOpacity` or `setStyle`, so styles such as a path's `fillOpacity` still apply on top.
- The adapter stacks layers in the manager's order, from the bottom up, whatever kind of layer they are. Each layer is drawn in its own Leaflet pane, named `ulm-<layerId>`, and the adapter sets each pane's `z-index` when the order changes. So a tile layer can sit above a polygon, and a marker below a tile layer.
  - The adapter sets the layer's `pane` option before adding it to the map, which replaces any `pane` you set yourself. It also sets `shadowPane` on markers, and the pane of every layer already in a `L.LayerGroup`, such as a `L.GeoJSON`.
  - The layer panes sit in one container pane, `ulmPane`, at `z-index` 450. That is above Leaflet's overlay pane (400) and below its shadow, marker, tooltip and popup panes (500–700), so popups, tooltips and markers you add yourself stay on top.
  - Each vector layer gets its own renderer. With `preferCanvas: true`, each one is a full-size `<canvas>`, and the top canvas takes the mouse events, so vector layers below it cannot be clicked. Use the default SVG renderer if you need to click overlapping vector layers.
- The adapter does not act on time info changes.

## License

MIT
