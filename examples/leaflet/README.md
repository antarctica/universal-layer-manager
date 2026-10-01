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
- Reordering layers and moving them between groups, with the map stacking layers in the same order

## How it works

The example uses:
- `LayerManager` from `@ulm/core` to create the layer manager instance
- `LayerManagerProvider` to expose the `LayerManager` via React context, and `@xstate/react` selectors to subscribe components to actor state
- `LeafletMap` component that renders a Leaflet map and initialises the base layers and marker, keeping the Leaflet adapter in sync with manager state
- `LayerList` component that provides a UI for managing layers (the layer list control), including toggling enable/disable, setting opacity and reordering by drag and drop. It lists layers top first, the reverse of the manager's bottom-first order
- The `@ulm/leaflet` adapter to keep Leaflet layer visibility, opacity and stacking in sync with the layer manager

### Layer Data Structure

Each layer stores a `LayerData` object containing:
- `leafletLayer`: The actual Leaflet layer instance (e.g., `L.TileLayer`, `L.Marker`)

The layer manager doesn't distinguish between layer types - it simply stores the Leaflet layer instance and syncs visibility/opacity state to it.

### Initial Layers

The example initialises with:
- A "Base Layers" group containing:
  - OpenStreetMap tile layer (visible)
  - Esri World Imagery tile layer (visible, below OpenStreetMap)
- A "Shapes" group, above the base layers, containing red, green and blue circles that overlap
- A "London Marker" marker at the center of the map, at the top level above everything else

### Adding Layers

- Click "+ Layer" to add a new marker at a random location near London
- Click "+ Group" to add a layer group (which can contain other layers or groups)
- Use checkboxes to toggle layer visibility
- Use opacity sliders to adjust layer opacity

### Reordering Layers

- Drag a layer or group by its ⠿ handle. Drop it on the top half of a row to place it above that row, or on the bottom half to place it below. Drop it on the middle of a group row to move it into that group, at the top
- Drag "Esri World Imagery" above "OpenStreetMap" to see it cover the map, or reorder the circles to change which one is drawn on top
- Every kind of layer follows the order: drag "Base Layers" above "Shapes" to draw the tile layers over the circles, or "London Marker" below "Shapes" to put it under them
- A layer moved into a group that is switched off stays switched on but hidden
- Moves the manager rejects, such as a group into itself, are logged as warnings in the browser console
- The panel uses the browser's HTML5 drag and drop, with no extra library. See `useLayerDragAndDrop.ts` for how a drop becomes a `moveLayer` call
