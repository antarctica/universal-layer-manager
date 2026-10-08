# @ulm/arcgis

ArcGIS Maps SDK for JavaScript adapter for [`@ulm/core`](https://www.npmjs.com/package/@ulm/core). As layers change in the manager, the adapter adds, removes, shows, hides, fades and stacks the matching ArcGIS layers, in a group layer of its own.

**[Documentation →](https://antarctica.github.io/universal-layer-manager/adapters/arcgis)**

## Installation

```bash
npm install @ulm/core @ulm/arcgis @arcgis/core
```

The package is published as ES modules only, like `@arcgis/core` 5.

## Minimal usage

Create each ArcGIS layer yourself and keep it in `layerData.arcgisLayer`. The adapter picks it up from there by default.

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

## Learn more

- [ArcGIS guide](https://antarctica.github.io/universal-layer-manager/adapters/arcgis): showing layers with renderLayer, and how stacking, visibility and opacity work
- [API reference](https://antarctica.github.io/universal-layer-manager/reference/arcgis)
- [`@ulm/core` documentation](https://antarctica.github.io/universal-layer-manager/)

## License

MIT
