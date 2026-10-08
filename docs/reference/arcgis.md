# @ulm/arcgis

## `new ArcGISLayerManagerAdapter<TLayer, TGroup>(map, options?)`

A `LayerManagerAdapter` for the ArcGIS Maps SDK for JavaScript. Attach it with `manager.setAdapter(adapter)`. `map` is the `Map` (or `WebMap`) your view shows. `TLayer` is your layer data type and `TGroup` your group data type, which defaults to `undefined`. See the [ArcGIS guide](../adapters/arcgis) for how it shows, stacks and fades layers.

**Options** (all optional):

| Option | Type | Description |
|--------|------|-------------|
| `renderLayer` | `(info, map, current?) => Layer \| null` | Returns the ArcGIS layer to show for a layer, or `null` to leave it off the map. Called when a layer is added, and again when its `layerData` or `timeInfo` changes, with the ArcGIS layer already shown as `current`. Return `current` to keep it. Defaults to `defaultArcGISRenderLayer`. Required unless the layer data is `ArcGISLayerData` |
| `disposeLayer` | `(arcgisLayer, layerId) => void` | Called with an ArcGIS layer `renderLayer` returned, once the adapter discards it: when its layer is removed, when `renderLayer` returns a different one, and when the adapter is detached. Not called when a layer is hidden. The adapter never destroys layers itself |
| `container` | `GroupLayer` | The group layer to keep every layer in, already placed on the map. Without it, the adapter creates a group with `listMode: 'hide'` and adds it to the top of the map |

`LayerManager` calls the adapter's methods as layers change, so you don't call them yourself. When the adapter is detached, replaced, or the manager is destroyed, it takes every layer it added off the map, and removes its group if it created it.

## `defaultArcGISRenderLayer(info)`

The default `renderLayer`: it returns `layerData.arcgisLayer` when present and otherwise `null`. Call it from your own `renderLayer` for the layers you don't handle.

## Types

| Type | Description |
|------|-------------|
| `ArcGISRenderLayer<TLayer>` | The type of the `renderLayer` option: `RenderLayer<TLayer, Map, Layer>` from `@ulm/core` |
| `ArcGISAdapterOptions<TLayer>` | The adapter's options: `RenderAdapterOptions<TLayer, Map, Layer>` from `@ulm/core`, with `container` |
| `ArcGISLayerData` | `{ arcgisLayer: Layer }`: the layer data the default shows. Extend it to keep more data on each layer |
