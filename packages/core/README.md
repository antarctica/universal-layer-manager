
<img src="./assets/universal-layer-manager.svg" alt="Universal Layer Manager logo" width="160" />


# @ulm/core

[![npm version](https://img.shields.io/npm/v/@ulm/core.svg)](https://www.npmjs.com/package/@ulm/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)

State-machine-powered layer management for map applications. Framework-agnostic core library built on [XState](https://xstate.js.org/).

## Installation

```bash
npm install @ulm/core
```

## Quick start

`LayerManager` is the primary public API. It wraps the XState machines and starts automatically on construction.

```ts
import { LayerManager } from '@ulm/core';
import type { AddLayerParams, AddGroupLayerParams } from '@ulm/core';

interface LayerData {
  url: string;
}

interface GroupData {
  category: string;
}

const manager = new LayerManager<LayerData, GroupData>({
  allowNestedGroupLayers: true,

  onLayerAdded(info) {
    console.log('added:', info.layerId);
  },
  onVisibilityChanged(info, visible) {
    console.log(info.layerId, 'visible:', visible);
  },
  onOpacityChanged(info, computedOpacity) {
    console.log(info.layerId, 'opacity:', computedOpacity);
  },
});

// Add a layer
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

// Add a group with a child layer
manager.addGroup({
  layerConfig: {
    layerId: 'overlays',
    layerName: 'Overlays',
    layerType: 'layerGroup',
    parentId: null,
    layerData: { category: 'overlays' },
  },
  visible: true,
});

manager.addLayer({
  layerConfig: {
    layerId: 'markers',
    layerName: 'Markers',
    layerType: 'layer',
    parentId: 'overlays',
    layerData: { url: '' },
  },
  visible: true,
});

// Control layers
manager.setVisibility('basemap', false);
manager.setOpacity('markers', 0.5);
manager.removeLayer('markers');

// Teardown
manager.destroy();
```

## API

### `new LayerManager<TLayer, TGroup>(options?)`

`TLayer` is the type of `layerData` stored on each layer; `TGroup` is the type for groups (defaults to `TLayer`).

**Options** — all optional:

| Option | Type | Description |
|--------|------|-------------|
| `allowNestedGroupLayers` | `boolean` | Allow groups inside other groups (default `false`) |
| `onLayerAdded` | `(info, visible) => void` | Called when a layer or group is added |
| `onLayerRemoved` | `(layerId) => void` | Called when a layer or group is removed |
| `onVisibilityChanged` | `(info, visible) => void` | Called on visibility toggle |
| `onOpacityChanged` | `(info, computedOpacity) => void` | Called when opacity changes (cascades from parents) |
| `onError` | `(error) => void` | Called on internal errors |

**Methods:**

| Method | Description |
|--------|-------------|
| `addLayer(params)` | Add a single layer |
| `addGroup(params)` | Add a layer group |
| `removeLayer(layerId)` | Remove a layer or group by ID |
| `setVisibility(layerId, visible)` | Show or hide a layer |
| `setOpacity(layerId, opacity)` | Set opacity (0–1) |
| `updateLayerData(layerId, data)` | Replace the `layerData` payload |
| `setAdapter(adapter \| null)` | Attach or detach a map-library adapter |
| `reset()` | Remove all layers and groups |
| `destroy()` | Teardown — stops the actor and cleans up |
| `getLayer(id)` | Return the managed item for an ID |

**Properties:**

| Property | Description |
|----------|-------------|
| `layers` | Current top-level items in display order |
| `actor` | Raw XState actor — escape hatch for `@xstate/react` (`useSelector`, etc.) |
| `isReady` | `true` while the actor is running |
| `destroyed` | `true` after `destroy()` |

### Lower-level access

`createLayerManagerMachine` (and the individual `layerMachine` / `layerGroupMachine`) are exported for use cases where you want to work with the XState actor model directly:

```ts
import { createLayerManagerMachine } from '@ulm/core';
import { createActor } from 'xstate';

const actor = createActor(createLayerManagerMachine<LayerData>(), {
  input: { allowNestedGroupLayers: true },
});
actor.start();
```

If you are using `LayerManager`, the same actor is also available as `manager.actor`.

## Adapters

To sync layer manager state with a map library, implement `LayerManagerAdapter` and pass it to `manager.setAdapter()`. See [`@ulm/leaflet`](../leaflet/README.md) for a ready-made Leaflet adapter.

## License

MIT
