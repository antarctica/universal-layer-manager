# @ulm/leaflet

Leaflet adapter for [`@ulm/core`](https://www.npmjs.com/package/@ulm/core). As layers change in the manager, the adapter adds, removes, shows, hides, fades and stacks the matching Leaflet layers.

**[Documentation →](https://antarctica.github.io/universal-layer-manager/adapters/leaflet)**

## Installation

```bash
npm install @ulm/core @ulm/leaflet leaflet
```

If you are using TypeScript, also install `@types/leaflet`.

## Minimal usage

Create each Leaflet layer yourself and keep it in `layerData.leafletLayer`. The adapter picks it up from there by default.

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

## Learn more

- [Leaflet guide](https://antarctica.github.io/universal-layer-manager/adapters/leaflet): drawing layers with renderLayer, and how stacking and opacity work
- [API reference](https://antarctica.github.io/universal-layer-manager/reference/leaflet)
- [`@ulm/core` documentation](https://antarctica.github.io/universal-layer-manager/)

## License

MIT
