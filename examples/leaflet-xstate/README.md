# Leaflet React Example with XState (advanced)

An advanced version of `examples/leaflet`. The layer list subscribes to each layer's XState actor with `@xstate/react` and sends events straight to the actors. Start with `examples/leaflet` unless you already use XState and want to work with the actors directly.

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

The example will be available at `http://localhost:5177`

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
  App.tsx                     the provider, the starting-layers effect, and the layer list beside the map
  layers/
    LayerManagerContext.ts    createActorContext for the manager machine, LayerData, and hooks that select actors
    startingLayers.ts         sends the starting layers to the manager actor it is given
  map/
    LeafletMap.tsx            the Leaflet map, attached to the manager actor with connectAdapter
  layerList/
    LayerList.tsx             add buttons, then every row, top first
    LayerRow.tsx              one layer or group, read from its actor and changed by sending it events
    AddLayerButtons.tsx       sends LAYER.ADD for a random marker or a group
    useLayerDragAndDrop.ts    sends LAYER.MOVE for a drop
```

`LayerManagerContext.Provider` creates the manager actor and stops it when it unmounts. Components get it with `LayerManagerContext.useActorRef()` and pass it on as an input: to `addStartingLayers`, to `connectAdapter` for the map, and as the target for `LAYER.ADD` and `LAYER.MOVE`. Each row gets its layer's actor as a prop, subscribes to it with `useSelector`, and sends it events such as `LAYER.SET_OPACITY`.

Compare it with `examples/leaflet`, which uses the `LayerManager` class and its layer tree instead. The page, the map and the row markup are the same.

### Layer Data Structure

Each layer stores a `LayerData` object containing:
- `leafletLayer`: The actual Leaflet layer instance (e.g., `L.TileLayer`, `L.Marker`)

The layer manager doesn't distinguish between layer types - it simply stores the Leaflet layer instance and syncs visibility/opacity state to it.

### Initial Layers

The example starts with these layers, added in `src/layers/startingLayers.ts`:
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
- The panel uses the browser's HTML5 drag and drop, with no extra library. See `layerList/useLayerDragAndDrop.ts` for how a drop becomes a `moveLayer` call
