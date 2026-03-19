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

- Constructing a `LayerManager` with inline option callbacks
- Rendering a nested tree of layers and layer groups using plain DOM manipulation
- Responding to `onLayerAdded`, `onVisibilityChanged`, and `onOpacityChanged` events to keep the UI in sync

## How it works

Everything lives in a single file (`src/main.ts`):

1. **`LayerManager` options** — `onLayerAdded`, `onVisibilityChanged`, and `onOpacityChanged` callbacks update the DOM directly when the manager emits changes
2. **`addLayer` / `addGroup`** — call `manager.addLayer` / `manager.addGroup` to add items; the `onLayerAdded` callback handles rendering
3. **`buildLayerEl`** — builds the DOM element for a layer or group, wiring checkbox and opacity slider events back to `manager.setVisibility` and `manager.setOpacity`
