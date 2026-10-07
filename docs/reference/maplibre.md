# @ulm/maplibre

## `new MapLibreLayerManagerAdapter<TLayer, TGroup>(map, options?)`

A `LayerManagerAdapter` for MapLibre GL JS. Attach it with `manager.setAdapter(adapter)`. `TLayer` is your layer data type and `TGroup` your group data type, which defaults to `undefined`. See the [MapLibre guide](../adapters/maplibre) for how it stacks, hides and fades layers.

**Options** (all optional):

| Option | Type | Description |
|--------|------|-------------|
| `layerFactory` | `(info, map) => MapLibreLayerStyle \| null` | Builds the sources and style layers for each new layer, and again when a layer's data is replaced. Return `null` to leave that layer off the map. Defaults to `createDefaultMapLibreFactory()` |
| `drawBelow` | `string` | The ID of a basemap style layer to draw every layer below. Without it, or while the map lacks that layer, layers draw below the first symbol layer with text, or on top when there is none |

`LayerManager` calls the adapter's methods as layers change, so you don't call them yourself. The adapter waits for the map's style to load before it draws, and draws the layers again after `map.setStyle`. When the adapter is detached, replaced, or the manager is destroyed, it removes every source and style layer it added from the map.

The adapter adds a source as `ulm:<sourceId>`, and a style layer as `ulm:<layerId>:<styleLayerId>`.

## `createDefaultMapLibreFactory<TLayer>()`

Returns the default factory, which uses `layerData` as the layer's style when it is a `MapLibreLayerStyle` and otherwise returns `null`.

## Types

| Type | Description |
|------|-------------|
| `MapLibreLayerStyle` | `{ sources?, layers }`: the sources a layer reads, by ID, and its style layers, bottom first. Layers that name the same source share it |
| `MapLibreLayerFactory<TLayer>` | The type of the `layerFactory` option |
| `MapLibreAdapterOptions<TLayer>` | The adapter's options |
| `StyleSpecification`, `LayerSpecification`, `SourceSpecification` | MapLibre's style, style layer and source types, which `maplibre-gl` itself does not export |
