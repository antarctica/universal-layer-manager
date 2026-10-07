# MapLibre React Example

A React + MapLibre GL JS example of the Universal Layer Manager (`@ulm/core`) with the `@ulm/maplibre` adapter. The layer list is the same as in `examples/leaflet`: it reads the manager's layer tree with `useSyncExternalStore` and changes layers through manager methods.

## Setup

From the root directory:

```bash
npm install
```

The example uses the local `@ulm/core` and `@ulm/maplibre` packages via workspace linking. Build them first with `npm run build`.

## Development

```bash
npm run dev
```

The example will be available at `http://localhost:5178`

## What the example demonstrates

- Raster tile layers (satellite imagery, and elevation from a raster DEM) and vector tile layers (parks, waterways, railways, 3D buildings) managed as layers and groups
- The adapter drawing every layer below the basemap's labels, in the manager's order
- Vector layers sharing one OpenFreeMap source, so its tiles load once
- Switching the basemap with `map.setStyle`, with the layers kept in place below the new labels

## How it works

```
src/
  main.tsx                    renders <App />
  App.tsx                     the layer list beside the map, and the chosen basemap
  layers/
    manager.ts                the LayerManager store, its LayerData type and starting layers
    styles.ts                 the MapLibre style of each starting layer
    drawings.ts               the style of a point or an area added with the buttons
    LayerManagerProvider.tsx  React context, plus useLayerTree and useLayer over useSyncExternalStore
  map/
    MapLibreMap.tsx           the MapLibre map, which attaches the @ulm/maplibre adapter while it is mounted
    basemaps.ts               the OpenFreeMap basemaps the switcher offers
  layerList/
    LayerList.tsx             add buttons, then every row, top first, then the basemap
    LayerRow.tsx              one layer or group: drag handle, switch, name, opacity and children
    AddLayerButtons.tsx       adds a point, a 5 km area or a group
    BasemapRow.tsx            the fixed basemap row with its switcher
    useLayerDragAndDrop.ts    turns a drop into a moveLayer call
```

### Layer data

Each layer's `layerData` is a MapLibre style: the sources it reads and its style layers, bottom first. That is what the adapter's default layer factory draws, so the adapter needs no options:

```ts
manager.setAdapter(new MapLibreLayerManagerAdapter<LayerData>(map));
```

To keep other data in `layerData`, such as a URL, pass a `layerFactory` that builds the style from it. It can hand any layer it does not handle to `createDefaultMapLibreFactory()`. See `MapLibreLayerFactory` in `@ulm/maplibre` for an example.

The adapter adds the sources and style layers under the IDs the style gives them, hides layers with `visibility`, fades them with their opacity, and moves them as the manager's order changes. Each style layer's ID is its layer's ID, so no two clash.

### The basemap

In MapLibre the basemap is the map's style, not a layer, so it is not in the manager. It sits in a fixed row at the bottom of the list. Choosing another basemap calls `map.setStyle`, and the adapter adds the managed layers back below the new style's labels.

### Things to try

- Switch on "Satellite imagery" or "Elevation" to see raster tiles under the vector layers and labels
- Drag "Raster tiles" above "OpenFreeMap vector tiles" to draw the imagery over the parks, waterways and railways
- Fade a group with its slider to fade every layer in it
- Click "+ Point" or "+ Area" to add a point or a 5 km circle in a random colour near London
- Zoom in past level 14 for the 3D buildings
- Switch the basemap to "Dark", and the layers stay in place
