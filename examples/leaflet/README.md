# Leaflet React Example

This is a React + Leaflet example demonstrating how to use the universal-layer-manager with Leaflet maps.

## Setup

From the root directory:

```bash
npm install
```

This will install dependencies for the workspace, including the example. The example uses the local `universal-layer-manager` package via workspace linking.

Or from the example directory:

```bash
cd examples/leaflet
npm install
```

## Development

```bash
npm run dev
```

The example will be available at `http://localhost:5175`

## What the example demonstrates

- Integrating the universal-layer-manager with Leaflet maps
- Syncing layer manager state (visibility, opacity) with Leaflet layers
- Managing tile layers and markers through the layer manager
- Using the layer list control to manage map layers
- Adding and removing layers dynamically

## How it works

The example uses:
- `createLayerManagerMachine()` to create a layer manager machine
- `LayerManagerProvider` to provide the layer manager context to React components
- `LeafletMap` component that renders a Leaflet map and syncs layer manager state with Leaflet layers
- `LayerManagerDemo` component that provides a UI for managing layers (the layer list control)
- React hooks to subscribe to layer state changes and update Leaflet layers accordingly

### Layer Types

The example supports two types of Leaflet layers:

1. **Tile Layers**: Base map layers (e.g., OpenStreetMap, CartoDB)
   - Controlled via `layerData.type: 'tile'`
   - Requires `url` and optional `attribution`

2. **Markers**: Point markers on the map
   - Controlled via `layerData.type: 'marker'`
   - Requires `position` (lat/lng) and optional `popupText`

### Adding Layers

- Click "+ Layer" to add a new marker at a random location
- Click "+ Group" to add a layer group
- Use checkboxes to toggle layer visibility
- Use opacity sliders to adjust layer opacity

The layer manager automatically syncs all state changes to the Leaflet map.