# Leaflet React Example

A React + Leaflet example of the Universal Layer Manager (`@ulm/core`). The layer list reads the manager's layer tree with `useSyncExternalStore` and changes layers through manager methods, with no XState in the example's own code.

For working with the layer and group actors directly through `@xstate/react`, see the advanced example in `examples/leaflet-xstate`.

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

```
src/
  main.tsx                    renders <App />
  App.tsx                     the layer list beside the map
  layers/
    manager.ts                the LayerManager store, its LayerData type and starting layers
    LayerManagerProvider.tsx  React context, plus useLayerTree and useLayer over useSyncExternalStore
  map/
    LeafletMap.tsx            the Leaflet map, which attaches the @ulm/leaflet adapter while it is mounted
  layerList/
    LayerList.tsx             add buttons, then every row, top first
    LayerRow.tsx              one layer or group: drag handle, switch, name, opacity and children
    AddLayerButtons.tsx       adds a random marker or a group
    useLayerDragAndDrop.ts    turns a drop into a moveLayer call
```

The manager is created once in `layers/manager.ts`, outside React, like a store. The map attaches the adapter while it is mounted, and the manager replays its layers to it. Each row reads its own layer with `useLayer`, and is memoised, so it re-renders only when that layer changes.

### Layer Data Structure

Each layer stores a `LayerData` object containing:
- `leafletLayer`: The actual Leaflet layer instance (e.g., `L.TileLayer`, `L.Marker`)

The layer manager doesn't distinguish between layer types - it simply stores the Leaflet layer instance and syncs visibility/opacity state to it.

### Initial Layers

The example starts with these layers, added in `src/layers/manager.ts`:
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
- The panel uses the browser's HTML5 drag and drop, with no extra library. See `layerList/useLayerDragAndDrop.ts` for how a drop becomes a `moveLayer` call, using the placement read from the layer tree
