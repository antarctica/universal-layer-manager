# @ulm/maplibre

## `new MapLibreLayerManagerAdapter<TLayer, TGroup>(map, options?)`

A `LayerManagerAdapter` for MapLibre GL JS. Attach it with `manager.setAdapter(adapter)`. `TLayer` is your layer data type and `TGroup` your group data type, which defaults to `undefined`. See the [MapLibre guide](../adapters/maplibre) for how it shows, stacks and fades layers.

**Options** (all optional):

| Option | Type | Description |
|--------|------|-------------|
| `renderLayer` | `(info, map, current?) => MapLibreLayerStyle \| null` | Returns the sources and style layers to show for a layer, or `null` to leave it off the map. Called when a layer is added, and again when its `layerData` or `timeInfo` changes, with the style it returned last time as `current`. Return `current` to leave the map as it is. Defaults to `defaultMapLibreRenderLayer`. Required unless the layer data is a `MapLibreLayerStyle` |
| `disposeLayer` | `(style, layerId) => void` | Called with a style `renderLayer` returned, once the adapter discards it: when its layer is removed, when `renderLayer` returns a different style, and when the adapter is detached. Not called when a layer is hidden, or when a style differs only in GeoJSON data or tile URLs, which MapLibre updates in place |
| `drawBelow` | `string` | The ID of a basemap style layer to draw every layer below. Without it, or while the map lacks that layer, layers draw below the first symbol layer with text, or on top when there is none |

`LayerManager` calls the adapter's methods as layers change, so you don't call them yourself. The adapter waits for the map's style to load before it shows anything, and shows the layers again after `map.setStyle`. When the adapter is detached, replaced, or the manager is destroyed, it removes every source and style layer it added from the map.

Sources and style layers keep the IDs `renderLayer` gives them. If the map already has one of a layer's IDs from elsewhere, such as the basemap, the adapter leaves that layer off the map and fires a MapLibre `error` event.

## `defaultMapLibreRenderLayer(info)`

The default `renderLayer`: it returns `layerData` as the layer's style when it is a `MapLibreLayerStyle` and otherwise `null`. Call it from your own `renderLayer` for the layers you don't handle.

## Types

| Type | Description |
|------|-------------|
| `MapLibreLayerStyle` | `{ sources?, layers }`: the sources a layer reads, by ID, and its style layers, bottom first. Layers that list the same source share it |
| `MapLibreRenderLayer<TLayer>` | The type of the `renderLayer` option: `RenderLayer<TLayer, MapLibreMap, MapLibreLayerStyle>` from `@ulm/core` |
| `MapLibreAdapterOptions<TLayer>` | The adapter's options: `RenderAdapterOptions` from `@ulm/core`, plus `drawBelow` |
| `StyleSpecification`, `LayerSpecification`, `SourceSpecification` | MapLibre's style, style layer and source types, which `maplibre-gl` itself does not export |
