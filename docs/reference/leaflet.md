# @ulm/leaflet

## `new LeafletLayerManagerAdapter<TLayer, TGroup>(map, options?)`

A `LayerManagerAdapter` for Leaflet. Attach it with `manager.setAdapter(adapter)`. `TLayer` is your layer data type and `TGroup` your group data type, which defaults to `undefined`. See the [Leaflet guide](../adapters/leaflet) for how it shows, stacks and fades layers.

**Options** (all optional):

| Option | Type | Description |
|--------|------|-------------|
| `renderLayer` | `(info, map, current?) => L.Layer \| null` | Returns the Leaflet layer to show for a layer, or `null` to leave it off the map. Called when a layer is added, and again when its `layerData` or `timeInfo` changes, with the Leaflet layer already shown as `current`. Return `current` to keep it. Defaults to `defaultLeafletRenderLayer`. Required unless the layer data is `LeafletLayerData` |
| `disposeLayer` | `(leafletLayer, layerId) => void` | Called with a Leaflet layer `renderLayer` returned, once the adapter discards it: when its layer is removed, when `renderLayer` returns a different one, and when the adapter is detached. Not called when a layer is hidden |

`LayerManager` calls the adapter's methods as layers change, so you don't call them yourself. When the adapter is detached, replaced, or the manager is destroyed, it removes every layer and pane it added from the map.

## `defaultLeafletRenderLayer(info)`

The default `renderLayer`: it returns `layerData.leafletLayer` when present and otherwise `null`. Call it from your own `renderLayer` for the layers you don't handle.

## `leafletLayerPane(layerId)`

Returns the name of the pane the adapter draws a layer in, `ulm-<layerId>`. Give it as the `pane` option to a Leaflet layer that copies its pane to another layer when it is built, such as a leaflet.wms source. See [Layers that build another layer](../adapters/leaflet#layers-that-build-another-layer).

## Types

| Type | Description |
|------|-------------|
| `LeafletRenderLayer<TLayer>` | The type of the `renderLayer` option: `RenderLayer<TLayer, L.Map, L.Layer>` from `@ulm/core` |
| `LeafletAdapterOptions<TLayer>` | The adapter's options: `RenderAdapterOptions<TLayer, L.Map, L.Layer>` from `@ulm/core` |
| `LeafletLayerData` | `{ leafletLayer: L.Layer }`: the layer data the default shows. Extend it to keep more data on each layer |
