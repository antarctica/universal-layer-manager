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
