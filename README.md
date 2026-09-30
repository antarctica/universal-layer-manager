
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

manager.setEnabled('basemap', false);
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

`LayerManager` owns the state and calls the adapter's methods as layers change: added, removed, shown or hidden, faded, re-dated, given new data or reordered. The adapter applies those changes to the map. Implement the `LayerManagerAdapter` interface and attach it with `manager.setAdapter(adapter)`; see [`@ulm/core`](./packages/core/README.md#adapters) for every method.

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

## Changelog

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
type(scope): description
```

A scope is required. It names the package that changed: `core`, `leaflet`, `examples`, `repo`, or `deps`.

| Type | Use for | In the changelog |
| --- | --- | --- |
| `feat` | User-visible capability | Added |
| `fix` | Defect repair | Fixed |
| `perf` | Measurable speed or resource change | Changed |
| `revert` | Undoes an earlier commit | Changed |
| `refactor`, `test`, `docs`, `build`, `ci`, `chore` | Internal work | Not shown |

`feat` and `fix` that remove or drop something land under Removed. Mark a breaking change with `!` before the colon.

```bash
npm run changelog:preview   # print the pending section
npm run changelog:draft     # prepend it to CHANGELOG.md
npm run version:next        # print the next version
```

Edit the drafted section before tagging. `@ulm/core` and `@ulm/leaflet` ship on the same tag, `vX.Y.Z`. The current release is [`v1.0.0`](https://github.com/antarctica/universal-layer-manager/releases/tag/v1.0.0). `v1.0.1` and `v1.0.2` already belong to the previous single package. If `npm run version:next` prints one of those, tag the next free version instead. See [CHANGELOG.md](./CHANGELOG.md).

---

## License

[MIT](./LICENSE)
