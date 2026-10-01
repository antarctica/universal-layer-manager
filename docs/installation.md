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

### Other map libraries

Leaflet is the only adapter we provide at the moment. For other map libraries, you can [write your own adapter](./adapters/writing-an-adapter).

## From a local clone

To run the examples or [contribute](./contributing), clone the repository and build it:

```sh
git clone https://github.com/antarctica/universal-layer-manager.git
cd universal-layer-manager
npm install
npm run build
npm run dev   # start the examples
```
