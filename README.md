
<img src="./packages/core/assets/universal-layer-manager.svg" alt="Universal Layer Manager logo" width="160" />


# Universal Layer Manager

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)
[![Docs](https://img.shields.io/badge/docs-antarctica.github.io-blue.svg)](https://antarctica.github.io/universal-layer-manager/)

A state-machine-powered layer management library for map applications. Model your map contents as layers and layer groups, then control visibility, opacity, and ordering from any UI framework and any mapping library.

**[API documentation →](https://antarctica.github.io/universal-layer-manager/)**

---

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@ulm/core`](./packages/core/README.md) | [![npm](https://img.shields.io/npm/v/@ulm/core.svg)](https://www.npmjs.com/package/@ulm/core) | Core state machine library — framework and map-library agnostic |
| [`@ulm/leaflet`](./packages/leaflet/README.md) | [![npm](https://img.shields.io/npm/v/@ulm/leaflet.svg)](https://www.npmjs.com/package/@ulm/leaflet) | Leaflet adapter — syncs manager state to a Leaflet map |

---

## Features

- **XState actor model**: Manager, layers, and layer groups are each XState actors.
- **Layers and layer groups**: Model flat lists or nested trees with optional depth control.
- **Framework-agnostic**: Pure TypeScript/XState core — works with any UI rendering layer.
- **Visibility and opacity**: Per-layer enable/disable and opacity that cascades through parents.
- **Time metadata**: Optional `LayerTimeInfo` using `@internationalized/date` for date ranges.
- **Typed events**: Strongly typed input and output events for reactive UIs.
- **Adapter pattern**: Implement `LayerManagerAdapter` to connect any mapping library.

---

## Quick start

```bash
npm install @ulm/core
```

```ts
import { LayerManager } from '@ulm/core';

interface LayerData {
  url: string;
}

const manager = new LayerManager<LayerData>({
  onLayerAdded(info) {
    console.log('added:', info.layerId);
  },
  onVisibilityChanged(info, visible) {
    console.log(info.layerId, 'visible:', visible);
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

manager.setVisibility('basemap', false);
manager.destroy();
```

See [`@ulm/core`](./packages/core/README.md) for the full API reference.

### Lower-level access

`createLayerManagerMachine` is exported for direct XState usage (e.g. integrating with `@xstate/react`):

```ts
import { createLayerManagerMachine } from '@ulm/core';
import { createActor } from 'xstate';

const actor = createActor(createLayerManagerMachine<LayerData>(), {
  input: { allowNestedGroupLayers: true },
});
actor.start();
```

If you're using `LayerManager`, the raw actor is also available via `manager.actor`.

---

## Adapters

`LayerManager` owns state; adapters subscribe to its emitted events and perform map-library side-effects (add/remove layers, sync visibility, opacity). Implement the `LayerManagerAdapter` interface and attach it with `manager.setAdapter(adapter)`.

```ts
import { LeafletLayerManagerAdapter } from '@ulm/leaflet';

manager.setAdapter(new LeafletLayerManagerAdapter(map));
// manager.setAdapter(null) detaches and calls adapter.unregister()
```

See [`@ulm/leaflet`](./packages/leaflet/README.md) for a complete example, or implement `LayerManagerAdapter` yourself for other mapping libraries (OpenLayers, Mapbox, etc.).

---

## Examples

| Example | Description |
|---------|-------------|
| [`examples/simple`](./examples/simple/README.md) | Minimal vanilla TypeScript — demonstrates `LayerManager` with plain DOM |
| [`examples/leaflet`](./examples/leaflet/README.md) | React + Leaflet — `@ulm/leaflet` adapter, nested groups, layer list UI |

To run an example:

```bash
npm install        # install all workspace dependencies
npm run dev        # starts all dev servers via Turbo
```

---

## Repository structure

```
packages/
  core/       @ulm/core — state machine library
  leaflet/    @ulm/leaflet — Leaflet adapter
examples/
  simple/     vanilla TypeScript example
  leaflet/    React + Leaflet example
```

---

## License

[MIT](./LICENSE)
