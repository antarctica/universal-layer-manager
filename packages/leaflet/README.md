# @ulm/leaflet

Leaflet adapter for [@ulm/core](../core/README.md). Subscribes to the layer manager's emitted events and syncs add/remove, visibility, and opacity to a Leaflet map.

## Installation

```bash
npm install @ulm/core @ulm/leaflet leaflet
```

## Minimal usage

Create a `LayerManager`, create a Leaflet map, then create the adapter and attach it with `setAdapter`. The adapter reacts to manager events and updates the map.

```ts
import * as L from 'leaflet';
import { LayerManager } from '@ulm/core';
import { LeafletLayerManagerAdapter } from '@ulm/leaflet';

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
manager.destroy();  // calls adapter.unregister() internally
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

Use `hooks` to run extra logic when the adapter adds/removes layers or changes visibility/opacity (e.g. custom behaviour for a "ship-track" style layer):

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

- **`new LeafletLayerManagerAdapter<TLayer>(map, options?)`**
  Implements `LayerManagerAdapter`. Attach to a manager with `manager.setAdapter(adapter)`.
  Generic `TLayer` is your `layerData` type.

- **`register(layerManager, callbacks)`**
  Called automatically by `LayerManager` when `setAdapter` is invoked. Not called directly.

- **`unregister()`**
  Called automatically by `LayerManager` on `setAdapter(null)` or `destroy()`. Removes all managed layers from the map.

- **`getContext()`**
  Returns the Leaflet map instance.

- **`createDefaultLeafletFactory<TLayer>()`**
  Returns a factory that reads `layerData.leafletLayer` when present (the default when no custom factory is passed).

## License

MIT
