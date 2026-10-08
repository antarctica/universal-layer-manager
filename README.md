
<img src="./docs/public/logo.svg" alt="Universal Layer Manager logo" width="160" />


# Universal Layer Manager

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)
[![Docs](https://img.shields.io/badge/docs-antarctica.github.io-blue.svg)](https://antarctica.github.io/universal-layer-manager/)

A state-machine-powered layer management library for map applications. Model your map contents as layers and layer groups, then control visibility, opacity, and ordering from any UI framework and any mapping library.

**[Documentation →](https://antarctica.github.io/universal-layer-manager/)**

---

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@ulm/core`](./packages/core/README.md) | [![npm](https://img.shields.io/npm/v/@ulm/core.svg)](https://www.npmjs.com/package/@ulm/core) | Core state machine library — framework and map-library agnostic |
| [`@ulm/leaflet`](./packages/leaflet/README.md) | [![npm](https://img.shields.io/npm/v/@ulm/leaflet.svg)](https://www.npmjs.com/package/@ulm/leaflet) | Leaflet adapter — syncs manager state to a Leaflet map |
| [`@ulm/maplibre`](./packages/maplibre/README.md) | [![npm](https://img.shields.io/npm/v/@ulm/maplibre.svg)](https://www.npmjs.com/package/@ulm/maplibre) | MapLibre GL JS adapter — syncs manager state to a MapLibre map's style |
| [`@ulm/arcgis`](./packages/arcgis/README.md) | [![npm](https://img.shields.io/npm/v/@ulm/arcgis.svg)](https://www.npmjs.com/package/@ulm/arcgis) | ArcGIS Maps SDK for JavaScript adapter — syncs manager state to an ArcGIS map's layers |
| [`@ulm/openlayers`](./packages/openlayers/README.md) | [![npm](https://img.shields.io/npm/v/@ulm/openlayers.svg)](https://www.npmjs.com/package/@ulm/openlayers) | OpenLayers adapter — syncs manager state to an OpenLayers map's layers |

For another map library, [write your own adapter](https://antarctica.github.io/universal-layer-manager/adapters/writing-an-adapter).

---

## Features

- **XState actor model**: Manager, layers, and layer groups are each XState actors.
- **Layers and layer groups**: Model flat lists or nested trees with optional depth control.
- **Framework-agnostic**: Pure TypeScript/XState core — works with any UI rendering layer.
- **Visibility and opacity**: Per-layer enable/disable and opacity that cascades through parents.
- **Ordering**: Move, raise and lower layers and groups, within a group or between groups, and adapters restack the map to match.
- **Time metadata**: Optional `LayerTimeInfo` with [Temporal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal) dates or date ranges.
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
```

Next, read [Getting started](https://antarctica.github.io/universal-layer-manager/getting-started) for the concepts, or put your layers on a map with the [Leaflet](https://antarctica.github.io/universal-layer-manager/adapters/leaflet), [MapLibre](https://antarctica.github.io/universal-layer-manager/adapters/maplibre), [ArcGIS](https://antarctica.github.io/universal-layer-manager/adapters/arcgis) or [OpenLayers](https://antarctica.github.io/universal-layer-manager/adapters/openlayers) adapter.

---

## Examples

| Example | Description |
|---------|-------------|
| [`examples/simple`](./examples/simple/README.md) ([live](https://antarctica.github.io/universal-layer-manager/examples/simple/)) | Minimal vanilla TypeScript — demonstrates `LayerManager` with plain DOM |
| [`examples/leaflet`](./examples/leaflet/README.md) ([live](https://antarctica.github.io/universal-layer-manager/examples/leaflet/)) | React + Leaflet — `@ulm/leaflet` adapter, nested groups, layer list UI with drag-and-drop reordering, read from the layer tree |
| [`examples/leaflet-xstate`](./examples/leaflet-xstate/README.md) ([live](https://antarctica.github.io/universal-layer-manager/examples/leaflet-xstate/)) | Advanced: the same example built on the layer actors with `@xstate/react` |
| [`examples/maplibre`](./examples/maplibre/README.md) ([live](https://antarctica.github.io/universal-layer-manager/examples/maplibre/)) | React + MapLibre — `@ulm/maplibre` adapter, raster and vector tile layers below the basemap's labels, and a basemap switcher |
| [`examples/arcgis`](./examples/arcgis/README.md) ([live](https://antarctica.github.io/universal-layer-manager/examples/arcgis/)) | React + ArcGIS — `@ulm/arcgis` adapter with `<arcgis-map>`, set in Antarctica, with a time-aware sea ice layer |
| [`examples/openlayers`](./examples/openlayers/README.md) ([live](https://antarctica.github.io/universal-layer-manager/examples/openlayers/)) | React + OpenLayers — `@ulm/openlayers` adapter, raster and vector tile layers between the basemap and its labels, and a basemap switcher |

To run them locally:

```bash
npm install        # install all workspace dependencies
npm run build      # build the packages
npm run dev        # start all dev servers via Turbo
```

---

## Repository structure

```
packages/
  core/       @ulm/core — state machine library
  leaflet/    @ulm/leaflet — Leaflet adapter
  maplibre/   @ulm/maplibre — MapLibre GL JS adapter
  arcgis/     @ulm/arcgis — ArcGIS Maps SDK for JavaScript adapter
  openlayers/ @ulm/openlayers — OpenLayers adapter
examples/
  simple/          vanilla TypeScript example
  leaflet/         React + Leaflet example
  leaflet-xstate/  the same example built on the actors (advanced)
  maplibre/        React + MapLibre example
  arcgis/          React + ArcGIS example, set in Antarctica
  openlayers/      React + OpenLayers example
docs/         documentation site (VitePress)
```

---

## Contributing

See [CONTRIBUTING.md](./.github/CONTRIBUTING.md) for pull requests, commit messages and releases. Changes are listed in [CHANGELOG.md](./CHANGELOG.md).

---

## License

[MIT](./LICENSE)
