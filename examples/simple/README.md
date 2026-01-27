# Universal Layer Manager - Simple Example

This is a simple example using React to demonstrate how to use the Universal Layer Manager library. It demonstrates how to use the library to manage layers and layer groups in a simple UI without any map integration.

Layers and Layer Groups can be added and opacity can be adjusted.

## Setup

From the root directory:

```bash
npm install
```

This will install dependencies for the workspace, including the example. The example uses the local `universal-layer-manager` package via workspace linking.

## Development

```bash
npm run dev
```

## What the example demonstrates
- Using the Universal Layer Manager library to manage layers and layer groups
- Creating a simple UI for managing layers and layer groups
- Using React hooks to subscribe to layer state changes and update the UI accordingly

## How it works

The example uses:
- `LayerManagerProvider` to create a layer manager actor and provide the context to React components
- `LayerList` component that renders a list of layers and layer groups
- `LayerGroupItem` component that renders a layer group
- `LayerItem` component that renders a single layer
- `LayerControls` component that renders the controls for adding new layers and layer groups