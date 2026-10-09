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
- Public layers managed as layers and groups:
  - Sea ice: daily AMSR2 sea ice concentration from the University of Bremen, a WMS layer from the Ice Logistics Portal's GeoServer, with a date to pick
  - Digital Database: high resolution contours as vector tiles with their heights labelled, and coastline, lakes and rock outcrop at medium resolution (only the coastline on at the start)
  - Ice sheet, off at the start: Bedmap3 bed topography and ice thickness as tiled images, and the grounding line where the ice starts to float
- The adapter adding every layer straight to the map, in the manager's order
- A time-aware layer: `renderLayer` sets the WMS layer's `timeExtent` from its time info, and ArcGIS asks the server for that day
- Popups from each layer's portal item, or a default one listing its fields

## How it works

```
src/
  main.tsx                    renders <App />
  App.tsx                     the layer list beside the map
  layers/
    manager.ts                the LayerManager store, its LayerData type and starting layers
    layers.ts                 the ArcGIS feature layers, loaded from their portal items
    LayerManagerProvider.tsx  React context, plus useLayerTree and useLayer over useSyncExternalStore
  map/
    ArcGISMap.tsx             the <arcgis-map> component, which attaches the @ulm/arcgis adapter while it is mounted
    renderLayer.ts            shows each layer's ArcGIS layer, set to the day its time info holds
  layerList/
    LayerList.tsx             every row, top first
    LayerRow.tsx              one layer or group: drag handle, switch, name, opacity and children
    LayerDateInput.tsx        the day a time-aware layer shows, which sets its time info
    BasemapRow.tsx            the fixed basemap row
    useLayerDragAndDrop.ts    turns a drop into a moveLayer call
```

### Layer data

Each layer's `layerData.arcgisLayer` is the ArcGIS layer that shows it. That is what the adapter shows by default, so it needs no options:

```ts
manager.setAdapter(new ArcGISLayerManagerAdapter<LayerData>(map));
```

The adapter adds the layers straight to the map, as ordinary layers. It shows and hides them with `visible`, fades them with `opacity`, and reorders them as the manager's order changes.

### Attaching to the map component

`<arcgis-map>` destroys its map, and every layer on it, when React removes it. `ArcGISMap` attaches the adapter in a layout effect, whose cleanup runs before that, so detaching takes the manager's layers off the map first and they can be shown again.

### Time

The sea ice layer is a `WMSLayer` with `useViewTime: false`, so it shows its own time rather than the view's. It starts on yesterday's date in its `timeInfo`. When the date changes, the adapter calls `renderLayer` again, which sets the layer's `timeExtent` to that day and returns the same layer. ArcGIS then sends the day as the WMS `TIME` parameter. Dates come from `temporal-polyfill`, as `@ulm/core` doesn't bundle one.

### The basemap

The basemap is the map's basemap, not a layer, so it is not in the manager. It sits in a fixed row at the bottom of the list.

### Things to try

- Switch on the Ice sheet group, then fade "Ice thickness" to see the bed topography under it
- Switch on "Contours", "Lakes" or "Rock outcrop" in the Digital Database group
- Drag "Rock outcrop" above "Coastline", or the Ice sheet group above the Digital Database
- Pick another date for the sea ice, such as one in September, when the ice is at its widest
- Fade a group with its slider to fade every layer in it
- Click a lake or the grounding line for its details
