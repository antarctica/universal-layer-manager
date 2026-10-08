# Installation

Universal Layer Manager consists of a core library `@ulm/core` and adapters for specific map libraries. Install the core package, then add an adapter for the map library you are using.

## Core

::: code-group

```sh [npm]
npm install @ulm/core
```

```sh [pnpm]
pnpm add @ulm/core
```

```sh [yarn]
yarn add @ulm/core
```

:::

### Dates for time info

You only need this if your layers carry [time info](./layers-and-groups#time-info). Dates are [Temporal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal) values, and [not every browser supports Temporal yet](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal#browser_compatibility), so install the polyfill as well:

::: code-group

```sh [npm]
npm install temporal-polyfill
```

```sh [pnpm]
pnpm add temporal-polyfill
```

```sh [yarn]
yarn add temporal-polyfill
```

:::

Then import `Temporal` from it wherever you create dates:

```ts
import { Temporal } from 'temporal-polyfill';
```

The TypeScript types come with `@ulm/core`, so there is nothing else to install.

## Adapters

### Leaflet

::: code-group

```sh [npm]
npm install @ulm/leaflet leaflet
```

```sh [pnpm]
pnpm add @ulm/leaflet leaflet
```

```sh [yarn]
yarn add @ulm/leaflet leaflet
```

:::

If you are using TypeScript, also install `@types/leaflet`.

### MapLibre

::: code-group

```sh [npm]
npm install @ulm/maplibre maplibre-gl
```

```sh [pnpm]
pnpm add @ulm/maplibre maplibre-gl
```

```sh [yarn]
yarn add @ulm/maplibre maplibre-gl
```

:::

`maplibre-gl` brings its own TypeScript types. The adapter needs `maplibre-gl` 6, and like it, is published as ES modules only.

### ArcGIS

::: code-group

```sh [npm]
npm install @ulm/arcgis @arcgis/core
```

```sh [pnpm]
pnpm add @ulm/arcgis @arcgis/core
```

```sh [yarn]
yarn add @ulm/arcgis @arcgis/core
```

:::

`@arcgis/core` brings its own TypeScript types. The adapter needs `@arcgis/core` 5, and like it, is published as ES modules only.

### OpenLayers

::: code-group

```sh [npm]
npm install @ulm/openlayers ol
```

```sh [pnpm]
pnpm add @ulm/openlayers ol
```

```sh [yarn]
yarn add @ulm/openlayers ol
```

:::

`ol` brings its own TypeScript types. The adapter needs `ol` 10, and like it, is published as ES modules only.

### Other map libraries

For other map libraries, you can [write your own adapter](./adapters/writing-an-adapter).

## From a local clone

To run the examples or [contribute](./contributing), clone the repository and build it:

```sh
git clone https://github.com/antarctica/universal-layer-manager.git
cd universal-layer-manager
npm install
npm run build
npm run dev   # start the examples
```
