# Leaflet React Example

This is a React + Leaflet example demonstrating a pattern for integrating the universal-layer-manager with Leaflet maps.

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

The example will be available at `http://localhost:5176`

## What the example demonstrates

- Integrating the universal-layer-manager with Leaflet maps
- Syncing layer manager state (visibility, opacity) with Leaflet layers
- Managing tile layers and markers through the layer manager
- Using the layer list control to manage map layers
- Supporting nested layer groups

## How it works

The example uses:
- `createLayerManagerMachine()` from `universal-layer-manager` wrapped in `createActorContext()` to create a layer manager machine
- `LayerManagerProvider` to provide the layer manager context to React components via XState's actor context
- `LeafletMap` component that renders a Leaflet map and syncs layer manager state with Leaflet layers
- `LayerList` component that provides a UI for managing layers (the layer list control)
- Event subscriptions to sync layer visibility and opacity changes between the layer manager and Leaflet map

### Layer Data Structure

Each layer stores a `LayerData` object containing:
- `leafletLayer`: The actual Leaflet layer instance (e.g., `L.TileLayer`, `L.Marker`)

The layer manager doesn't distinguish between layer types - it simply stores the Leaflet layer instance and syncs visibility/opacity state to it.

### Initial Layers

The example initialises with:
- A "Base Layers" group containing:
  - OpenStreetMap tile layer (visible by default)
  - CartoDB Positron tile layer (hidden by default)
- A "London Marker" marker at the center of the map

### Adding Layers

- Click "+ Layer" to add a new marker at a random location near London
- Click "+ Group" to add a layer group (which can contain other layers or groups)
- Use checkboxes to toggle layer visibility
- Use opacity sliders to adjust layer opacity

The layer manager automatically syncs all state changes to the Leaflet map through event subscriptions (`LAYER.ADDED`, `LAYER.VISIBILITY_CHANGED`, `LAYER.OPACITY_CHANGED`).