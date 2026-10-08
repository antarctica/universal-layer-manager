# ArcGIS React Example

A React + ArcGIS Maps SDK for JavaScript example of the Universal Layer Manager (`@ulm/core`) with the `@ulm/arcgis` adapter, set in Antarctica. The map is the `<arcgis-map>` component from `@arcgis/map-components`. The layer list is the same as in `examples/maplibre`: it reads the manager's layer tree with `useSyncExternalStore` and changes layers through manager methods.

## Setup

From the root directory:

```bash
npm install
```

The example uses the local `@ulm/core` and `@ulm/arcgis` packages via workspace linking. Build them first with `npm run build`.

## Development

```bash
npm run dev
```

The example will be available at `http://localhost:5179`

## What the example demonstrates

- The British Antarctic Survey basemap, "Antarctica and the Southern Ocean", in Antarctic Polar Stereographic (EPSG:3031)
- Public ArcGIS Online layers managed as layers and groups:
  - Digital Database: high resolution contours as vector tiles with their heights labelled, and coastline, lakes and rock outcrop at medium resolution (only the coastline on at the start)
  - Ice sheet, off at the start: Bedmap3 bed topography and ice thickness as tiled images, and the grounding line where the ice starts to float
- The adapter keeping every layer in one group layer of its own, in the manager's order
- Popups from each layer's portal item, or a default one listing its fields

## How it works

```
src/
  main.tsx                    renders <App />, with the ArcGIS stylesheet
  App.tsx                     the layer list beside the map
  layers/
    manager.ts                the LayerManager store, its LayerData type and starting layers
    layers.ts                 the ArcGIS feature layers, loaded from their portal items
    LayerManagerProvider.tsx  React context, plus useLayerTree and useLayer over useSyncExternalStore
  map/
    ArcGISMap.tsx             the <arcgis-map> component, which attaches the @ulm/arcgis adapter while it is mounted
  layerList/
    LayerList.tsx             every row, top first
    LayerRow.tsx              one layer or group: drag handle, switch, name, opacity and children
    BasemapRow.tsx            the fixed basemap row
    useLayerDragAndDrop.ts    turns a drop into a moveLayer call
```

### Layer data

Each layer's `layerData.arcgisLayer` is the ArcGIS layer that shows it. That is what the adapter shows by default, so it needs no options:

```ts
manager.setAdapter(new ArcGISLayerManagerAdapter<LayerData>(map));
```

The adapter adds the layers to a group layer it puts on top of the map, hidden from ArcGIS layer lists. It shows and hides them with `visible`, fades them with `opacity`, and reorders them in the group as the manager's order changes.

### Attaching to the map component

`<arcgis-map>` destroys its map, and every layer on it, when React removes it. `ArcGISMap` attaches the adapter in a layout effect, whose cleanup runs before that, so detaching takes the manager's layers off the map first and they can be shown again.

### The basemap

The basemap is the map's basemap, not a layer, so it is not in the manager. It sits in a fixed row at the bottom of the list.

### Things to try

- Switch on the Ice sheet group, then fade "Ice thickness" to see the bed topography under it
- Switch on "Contours", "Lakes" or "Rock outcrop" in the Digital Database group
- Drag "Rock outcrop" above "Coastline", or the Ice sheet group above the Digital Database
- Fade a group with its slider to fade every layer in it
- Click a lake or the grounding line for its details
