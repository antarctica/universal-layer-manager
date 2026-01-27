
<img src="./packages/universal-layer-manager/assets/universal-layer-manager.svg" alt="Universal Layer Manager logo" width="160" />



# A universal, state-machine-powered layer management library for map applications.


[![npm version](https://img.shields.io/npm/v/universal-layer-manager.svg)](https://www.npmjs.com/package/universal-layer-manager)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)

---

### Overview

`universal-layer-manager` provides a small set of state machines for managing map layers and layer groups in a framework‑agnostic way.

You model your map contents as layers and layer groups, start a single **layer manager** actor, and then:

- add or remove layers,
- control visibility, opacity, and temporal information,
- and react to emitted events (such as order or visibility changes)

from any mapping library (Leaflet, OpenLayers, Mapbox, etc.) and any UI framework (React, Vue, vanilla JS, etc.).

### Features

- **XState actor model**: Uses XState actors for the manager, layers, and layer groups.
- **Layers and layer groups**: Model single layers or tree‑like groups with optional nesting.
- **Framework‑agnostic**: Pure TypeScript/XState core that works with any mapping library and any UI rendering layer.
- **Visibility and opacity**: Per‑layer enable/disable, visibility, and computed opacity that cascades through parents.
- **Time metadata**: Optional `LayerTimeInfo` using `@internationalized/date` for date and date‑time ranges.
- **Typed events**: Strongly typed input and output events for building reactive UIs.

### Installation

```bash
npm install universal-layer-manager
```

### Quick Start
This example shows how to create a layer manager, register listeners, add a couple of layers, and then change visibility.  

```ts
import type { LayerConfig, LayerGroupConfig } from 'universal-layer-manager';
import {
  createLayerManagerMachine,
  findManagedLayerById,
} from 'universal-layer-manager';
import { createActor } from 'xstate';

// Define internal data types for the layers and layer groups.
interface LayerData {
  notes: string;
}

interface GroupData {
  reference: string;
}

// 1. Create the manager machine and actor
const managerMachine = createLayerManagerMachine<LayerData, GroupData>();

const manager = createActor(managerMachine, {
  input: {
    allowNestedGroupLayers: true,
  },
});

// 2. Register listeners

// will fire when a layer is added to the manager
manager.on('LAYER.ADDED', (event) => {
  console.log('Layer added:', event.layerId);
});

// will fire when the visibility of a layer is changed
manager.on('LAYER.VISIBILITY_CHANGED', (event) => {
  console.log(`Layer ${event.layerId} visible:`, event.visible);
});

// 3. Start the manager
manager.start();

// 4. Add an example layer
const exampleLayerConfig: LayerConfig<LayerData> = {
  layerId: 'example',
  layerName: 'Example layer',
  parentId: null, // no parent as it sits at the top level
  layerType: 'layer',
  layerData: { notes: 'This is an example layer' },
};

manager.send({
  type: 'LAYER.ADD',
  params: {
    layerConfig: exampleLayerConfig,
    visible: true,
  },
});

// 5. Add an example group with a child layer
const exampleGroupConfig: LayerGroupConfig<LayerData, GroupData> = {
  layerId: 'overlays',
  layerName: 'Overlays',
  parentId: null, // no parent as it sits at the top level
  layerType: 'layerGroup',
  layerData: { reference: 'This is an example group' },
};

manager.send({
  type: 'LAYER.ADD',
  params: {
    layerConfig: exampleGroupConfig,
    visible: true,
  },
});

const exampleChildLayerConfig: LayerConfig<LayerData> = {
  layerId: 'example-child',
  layerName: 'Example child layer',
  parentId: 'overlays', // the parent is the group we added above
  layerType: 'layer',
  layerData: { notes: 'This is an example child layer' },
};

manager.send({
  type: 'LAYER.ADD',
  params: {
    layerConfig: exampleChildLayerConfig,
    visible: true,
  },
});

// 6. access the current layers
const currentLayers = manager.getSnapshot().context.layers;
console.log('Current layers:', currentLayers.map((layer) => layer.layerActor.id));

// 7. change the visibility of the example layer
const exampleLayerActor = findManagedLayerById(currentLayers, 'example')?.layerActor;

if (exampleLayerActor) {
  exampleLayerActor.send({
    type: 'LAYER.ENABLED' });
}
// this will trigger the LAYER.VISIBILITY_CHANGED listener above.

```

To integrate with React, you can use `@xstate/react` and wrap the manager actor in a context provider, as shown in the `examples/simple` app.

### Examples

There are two example applications in this repository:

- **`examples/simple`**: A minimal React UI that demonstrates basic layer manager usage and a simple layer list.
- **`examples/leaflet`**: A Leaflet‑based map example that wires the layer manager to actual map layers.

Both examples are good starting points for integrating `universal-layer-manager` into your own application.

### License

This project is licensed under the [MIT License](../../LICENSE).

