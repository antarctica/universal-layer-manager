# @ulm/openlayers

OpenLayers adapter for [`@ulm/core`](https://www.npmjs.com/package/@ulm/core). As layers change in the manager, the adapter adds, removes, shows, hides, fades and stacks the matching OpenLayers layers, in a layer group of its own.

**[Documentation →](https://antarctica.github.io/universal-layer-manager/adapters/openlayers)**

## Installation

```bash
npm install @ulm/core @ulm/openlayers ol
```

The package is published as ES modules only.

## Minimal usage

Create each OpenLayers layer yourself and keep it in `layerData.openlayersLayer`. The adapter picks it up from there by default.

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

## Learn more

- [OpenLayers guide](https://antarctica.github.io/universal-layer-manager/adapters/openlayers): showing layers with renderLayer, and how stacking, visibility and opacity work
- [API reference](https://antarctica.github.io/universal-layer-manager/reference/openlayers)
- [`@ulm/core` documentation](https://antarctica.github.io/universal-layer-manager/)

## License

MIT
