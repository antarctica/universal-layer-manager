# OpenLayers React Example

A React + OpenLayers example of the Universal Layer Manager (`@ulm/core`) with the `@ulm/openlayers` adapter. The layer list is the same as in `examples/maplibre`: it reads the manager's layer tree with `useSyncExternalStore` and changes layers through manager methods.

## Setup

From the root directory:

```bash
npm install
```

The example uses the local `@ulm/core` and `@ulm/openlayers` packages via workspace linking. Build them first with `npm run build`.

## Development

```bash
npm run dev
```

The example will be available at `http://localhost:5180`

## What the example demonstrates

- Raster tile layers (satellite imagery and hillshade) and vector tile layers (parks, waterways, railways, buildings) managed as layers and groups
- The adapter drawing every layer in a group of the app's own, between the basemap and its labels, with the `container` option
- Vector layers sharing one OpenFreeMap source
- Switching the basemap, which is the app's own layers, while the managed layers stay in place

## How it works

```
src/
  main.tsx                    renders <App />
  App.tsx                     the layer list beside the map, and the chosen basemap
  layers/
    manager.ts                the LayerManager store, its LayerData type and starting layers
    startingLayers.ts         the OpenLayers layer of each starting layer
    drawings.ts               the layer of a point or an area added with the buttons
    LayerManagerProvider.tsx  React context, plus useLayerTree and useLayer over useSyncExternalStore
  map/
    OpenLayersMap.tsx         the OpenLayers map, which attaches the @ulm/openlayers adapter while it is mounted
    basemaps.ts               the Esri basemaps the switcher offers, each as a base and its labels
  layerList/
    LayerList.tsx             add buttons, then every row, top first
    LayerRow.tsx              one layer or group: drag handle, switch, name, opacity and children
    AddLayerButtons.tsx       adds a point, a 5 km area or a group
    BasemapRow.tsx            the fixed basemap row with its switcher
    useLayerDragAndDrop.ts    turns a drop into a moveLayer call
```

### Layer data

Each layer's `layerData.openlayersLayer` is the OpenLayers layer that draws it. That is what the adapter shows by default, so it needs no `renderLayer`:

```ts
manager.setAdapter(new OpenLayersLayerManagerAdapter<LayerData>(map, { container: managedLayers }));
```

To keep other data in `layerData`, such as a URL, pass a `renderLayer` that builds the layer from it. It can hand any layer it does not handle to `defaultOpenLayersRenderLayer(info)`.

The adapter adds each layer to the group, switches it on and off with `setVisible`, fades it with `setOpacity`, and reorders the group as the manager's order changes.

### The basemap

The basemap is two tile layers of the app's own: the map without labels, and the labels alone. The map holds them with the adapter's group between them:

```ts
const map = new OlMap({ target, layers: [base, managedLayers, labels], view });
```

Choosing another basemap gives both layers a new source. The managed layers are untouched.

The starting layers are created once, when the app loads, and live as long as the manager. Detaching the adapter takes them off the map without disposing of them, so they can be shown again when the map remounts.

### Things to try

- Switch on "Satellite imagery" or "Hillshade" to see raster tiles under the vector layers and labels
- Drag "Raster tiles" above "OpenFreeMap vector tiles" to draw the imagery over the parks, waterways and railways
- Fade a group with its slider to fade every layer in it
- Click "+ Point" or "+ Area" to add a point or a 5 km circle in a random colour near London
- Zoom in past level 14 for the buildings
- Switch the basemap to "Dark Gray", and the layers stay in place
