# Universal Layer Manager - Simple Example

A minimal vanilla TypeScript example demonstrating how to use `@ulm/core` without any framework or map library.

## Setup

From the root directory:

```bash
npm install
```

This will install dependencies for the workspace, including the example. The example uses the local `@ulm/core` package via workspace linking.

## Development

```bash
npm run dev
```

## What the example demonstrates

- Constructing a `LayerManager` with option callbacks
- Drawing a nested list of layers and groups with plain DOM code
- Switching layers on and off, changing their opacity, raising, lowering and removing them
- Logging every change hook as it fires, to show what one action reports

## How it works

Everything lives in a single file (`src/main.ts`):

1. **`LayerManager` options** — each change hook (`onLayerAdded`, `onVisibilityChanged`, `onOrderChanged` and the rest) and `onError` writes a line to the event log
2. **`manager.subscribe(render)`** — redraws the list after every change, so the list is always drawn from the manager's current state
3. **`addLayer` / `addGroup`** — call `manager.addLayer` / `manager.addGroup`
4. **`render` / `renderLayer`** — draw the whole list again. The manager orders layers from the bottom up, so the list reverses each group's order to show the top layer first. Each row's controls call `manager.setEnabled`, `manager.setOpacity`, `manager.raiseLayer`, `manager.lowerLayer` and `manager.removeLayer`
