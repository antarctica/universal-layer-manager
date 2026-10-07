# @ulm/maplibre

MapLibre GL JS adapter for [`@ulm/core`](https://www.npmjs.com/package/@ulm/core). As layers change in the manager, the adapter adds, removes, shows, hides, fades and stacks each layer's sources and style layers, below the basemap's labels.

**[Documentation →](https://antarctica.github.io/universal-layer-manager/adapters/maplibre)**

## Installation

```bash
npm install @ulm/core @ulm/maplibre maplibre-gl
```

The package is published as ES modules only, like `maplibre-gl` 6.

## Minimal usage

Keep each layer's MapLibre style in `layerData`: the sources it reads and its style layers, bottom first. The adapter draws it from there by default.

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
    layerId: 'imagery',
    layerName: 'Satellite imagery',
    layerType: 'layer',
    layerData: {
      sources: {
        imagery: {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
        },
      },
      layers: [{ id: 'tiles', type: 'raster', source: 'imagery' }],
    },
  },
  visible: true,
});
```

## Learn more

- [MapLibre guide](https://antarctica.github.io/universal-layer-manager/adapters/maplibre): layer factories, shared sources, and how stacking, visibility and opacity work
- [API reference](https://antarctica.github.io/universal-layer-manager/reference/maplibre)
- [`@ulm/core` documentation](https://antarctica.github.io/universal-layer-manager/)

## License

MIT
