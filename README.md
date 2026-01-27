<p align="center" style="margin-bottom: 0;">
  <img src="./packages/universal-layer-manager/assets/universal-layer-manager.svg" alt="Universal Layer Manager logo" width="160" />
</p>

<h3 align="center" style="margin-top: 0.5em;">Universal Layer Manager</h3>

Universal, XState-powered layer management for map applications.

[![npm version](https://img.shields.io/npm/v/universal-layer-manager.svg)](https://www.npmjs.com/package/universal-layer-manager)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)

---

### Overview

`universal-layer-manager` provides a small set of XState v5 state machines for managing map layers and layer groups in a framework‑agnostic way.

You model your map contents as layers and layer groups, start a single **layer manager** actor, and then:

- add or remove layers,
- control visibility, opacity, and temporal information,
- and react to emitted events (such as order or visibility changes)

from any UI framework (React, Vue, vanilla JS, etc.).

### Features

- **XState v5 actor model**: Uses XState actors for the manager, layers, and layer groups.
- **Layers and layer groups**: Model single layers or tree‑like groups with optional nesting.
- **Framework‑agnostic**: Pure TypeScript/XState core that works with any UI rendering layer.
- **Visibility and opacity**: Per‑layer enable/disable, visibility, and computed opacity that cascades through parents.
- **Time metadata**: Optional `LayerTimeInfo` using `@internationalized/date` for date and date‑time ranges.
- **Typed events**: Strongly typed input and output events for building reactive UIs.
- **Utilities included**: Helpers for querying and ordering layers (`findManagedLayerById`, `getFlatLayerOrder`, `calculateComputedOpacity`, and more).

### Installation

```bash
npm install universal-layer-manager
```

### Quick Start

This example shows how to create a layer manager, register listeners up‑front, add a couple of layers, and then change visibility.  
It follows the **Introduce Parameter Object** refactoring from Martin Fowler by grouping layer configuration into `LayerConfig`.

```ts
import { createActor } from 'xstate';
import {
  createLayerManagerMachine,
  type LayerConfig,
  type LayerGroupConfig,
} from 'universal-layer-manager';

interface LayerData {
  id: string;
}

interface GroupData {
  name: string;
}

// 1. Create the manager machine and actor
const managerMachine = createLayerManagerMachine<LayerData, GroupData>();

const manager = createActor(managerMachine, {
  input: {
    allowNestedGroupLayers: true,
  },
});

// 2. Register listeners before changing any state
manager.on('LAYER.ORDER_CHANGED', (event) => {
  console.log('Flat layer order:', event.layerOrder);
});

manager.on('LAYER.VISIBILITY_CHANGED', (event) => {
  console.log(`Layer ${event.layerId} visible:`, event.visible);
});

manager.start();

// 3. Define layer configs
const baseLayerConfig: LayerConfig<LayerData> = {
  layerId: 'base',
  layerName: 'Base map',
  parentId: null,
  layerType: 'layer',
  layerData: { id: 'osm' },
};

const roadsLayerConfig: LayerConfig<LayerData> = {
  layerId: 'roads',
  layerName: 'Road network',
  parentId: null,
  layerType: 'layer',
  layerData: { id: 'roads-source' },
};

const overlaysGroupConfig: LayerGroupConfig<LayerData, GroupData> = {
  layerId: 'overlays',
  layerName: 'Overlays',
  parentId: null,
  layerType: 'layerGroup',
  layerData: { name: 'Overlays group' },
  listMode: 'show',
};

// 4. Add layers via manager events
manager.send({
  type: 'LAYER.ADD',
  params: {
    layerConfig: baseLayerConfig,
    visible: true,
    position: 'bottom',
  },
});

manager.send({
  type: 'LAYER.ADD',
  params: {
    layerConfig: roadsLayerConfig,
    visible: true,
    position: 'top',
  },
});

manager.send({
  type: 'LAYER.ADD',
  params: {
    layerConfig: overlaysGroupConfig,
    visible: true,
    position: 'top',
  },
});

// 5. Change visibility through the manager
// This will trigger the LAYER.VISIBILITY_CHANGED listener above.
manager.send({
  type: 'LAYER.UPDATE_VISIBILITY',
  layerId: 'roads',
  visible: false,
});
```

To integrate with React, you can use `@xstate/react` and wrap the manager actor in a context provider, as shown in the `examples/simple` app.

### Examples

There are two example applications in this repository:

- **`examples/simple`**: A minimal React UI that demonstrates basic layer manager usage and a simple layer list.
- **`examples/leaflet`**: A Leaflet‑based map example that wires the layer manager to actual map layers.

Both examples are good starting points for integrating `universal-layer-manager` into your own application.

### License

This project is licensed under the [MIT License](../../LICENSE).

