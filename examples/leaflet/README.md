# Leaflet React Example

This is a React + Leaflet example demonstrating a pattern for integrating the Universal Layer Manager (`@ulm/core`) with Leaflet maps.

## Setup

From the root directory:

```bash
npm install
```

This will install dependencies for the workspace, including the example. The example uses the local `@ulm/core` and `@ulm/leaflet` packages via workspace linking.

## Development

```bash
npm run dev
```

The example will be available at `http://localhost:5176`

## What the example demonstrates

- Integrating the @ulm/core with Leaflet maps
- Syncing layer manager state (visibility, opacity) with Leaflet layers
- Managing tile layers and markers through the layer manager
- Using the layer list control to manage map layers
- Supporting nested layer groups

## How it works

The example uses:
- `LayerManager` from `@ulm/core` to create the layer manager instance
- `LayerManagerProvider` to expose the `LayerManager` via React context, and `@xstate/react` selectors to subscribe components to actor state
- `LeafletMap` component that renders a Leaflet map and initialises the base layers and marker, keeping the Leaflet adapter in sync with manager state
- `LayerList` component that provides a UI for managing layers (the layer list control), including toggling enable/disable and setting opacity
- The `@ulm/leaflet` adapter to keep Leaflet layer visibility and opacity in sync with the layer manager

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