# @ulm/openlayers

## `new OpenLayersLayerManagerAdapter<TLayer, TGroup>(map, options?)`

A `LayerManagerAdapter` for OpenLayers. Attach it with `manager.setAdapter(adapter)`. `map` is the OpenLayers `Map`. `TLayer` is your layer data type and `TGroup` your group data type, which defaults to `undefined`. See the [OpenLayers guide](../adapters/openlayers) for how it shows, stacks and fades layers.

**Options** (all optional):

| Option | Type | Description |
|--------|------|-------------|
| `renderLayer` | `(info, map, current?) => BaseLayer \| null` | Returns the OpenLayers layer to show for a layer, or `null` to leave it off the map. Called when a layer is added, and again when its `layerData` or `timeInfo` changes, with the OpenLayers layer already shown as `current`. Return `current` to keep it. Defaults to `defaultOpenLayersRenderLayer`. Required unless the layer data is `OpenLayersLayerData` |
| `disposeLayer` | `(openlayersLayer, layerId) => void` | Called with an OpenLayers layer `renderLayer` returned, once the adapter discards it: when its layer is removed, when `renderLayer` returns a different one, and when the adapter is detached. Not called when a layer is hidden. The adapter never disposes of layers itself |
| `container` | `LayerGroup` | A layer group to draw every layer in. Add it to the map yourself first: the adapter doesn't. Without it, the adapter adds each layer straight to the map, above the layers already there |

`LayerManager` calls the adapter's methods as layers change, so you don't call them yourself. When the adapter is detached, replaced, or the manager is destroyed, it takes every layer it added off the map. A `container` stays on the map, empty.

## `defaultOpenLayersRenderLayer(info)`

The default `renderLayer`: it returns `layerData.openlayersLayer` when present and otherwise `null`. Call it from your own `renderLayer` for the layers you don't handle.

## Types

| Type | Description |
|------|-------------|
| `OpenLayersRenderLayer<TLayer>` | The type of the `renderLayer` option: `RenderLayer<TLayer, Map, BaseLayer>` from `@ulm/core` |
| `OpenLayersAdapterOptions<TLayer>` | The adapter's options: `RenderAdapterOptions<TLayer, Map, BaseLayer>` from `@ulm/core`, with `container` |
| `OpenLayersLayerData` | `{ openlayersLayer: BaseLayer }`: the layer data the default shows. Extend it to keep more data on each layer |
