<img src="../../docs/public/logo.svg" alt="Universal Layer Manager logo" width="160" />

# @ulm/core

[![npm version](https://img.shields.io/npm/v/@ulm/core.svg)](https://www.npmjs.com/package/@ulm/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)

State-machine-powered layer management for map applications. Model your map contents as layers and layer groups, then control visibility, opacity and ordering from any UI framework and any map library. Built on [XState](https://stately.ai/docs/xstate).

**[Documentation →](https://antarctica.github.io/universal-layer-manager/)**

## Installation

```bash
npm install @ulm/core
```

If your layers carry time info, also install the Temporal polyfill, because [not every browser supports Temporal yet](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal#browser_compatibility):

```bash
npm install temporal-polyfill
```

Then import `Temporal` from `temporal-polyfill` wherever you create dates. See [Time info](https://antarctica.github.io/universal-layer-manager/layers-and-groups#time-info).

## Quick start

```ts
import { LayerManager } from '@ulm/core';

interface LayerData {
  url: string;
}

const manager = new LayerManager<LayerData>({
  onVisibilityChanged(info, visible) {
    console.log(info.layerName, visible ? 'showing' : 'hidden');
  },
});

manager.addLayer({
  layerConfig: {
    layerId: 'basemap',
    layerName: 'Basemap',
    layerType: 'layer',
    parentId: null,
    layerData: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
  },
  visible: true,
});

manager.setOpacity('basemap', 0.5);
```

To draw the layers on a map, attach an adapter such as [`@ulm/leaflet`](https://www.npmjs.com/package/@ulm/leaflet).

## Learn more

- [Getting started](https://antarctica.github.io/universal-layer-manager/getting-started): the concepts behind the manager
- [Layers and groups](https://antarctica.github.io/universal-layer-manager/layers-and-groups)
- [Visibility and opacity](https://antarctica.github.io/universal-layer-manager/visibility-and-opacity)
- [Ordering and moving](https://antarctica.github.io/universal-layer-manager/ordering)
- [Writing an adapter](https://antarctica.github.io/universal-layer-manager/adapters/writing-an-adapter)
- [Working with XState](https://antarctica.github.io/universal-layer-manager/xstate)
- [API reference](https://antarctica.github.io/universal-layer-manager/reference/core)

## License

MIT
