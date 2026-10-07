# @ulm/leaflet

## `new LeafletLayerManagerAdapter<TLayer, TGroup>(map, options?)`

A `LayerManagerAdapter` for Leaflet. Attach it with `manager.setAdapter(adapter)`. `TLayer` is your layer data type and `TGroup` your group data type, which defaults to `undefined`. See the [Leaflet guide](../adapters/leaflet) for how it stacks and fades layers.

**Options** (all optional):

| Option | Type | Description |
|--------|------|-------------|
| `layerFactory` | `(info, map, current?) => L.Layer \| null` | Creates the Leaflet layer for each new layer, and again when a layer's data is replaced, with the Leaflet layer already drawn as `current`. Return `current` to keep it, or `null` to leave that layer off the map. Defaults to `createDefaultLeafletFactory()` |
| `hooks` | `LeafletAdapterHooks` | Your own code to run after the adapter updates a Leaflet layer (see below) |

**Hooks** (all optional; each runs only for layers that have a Leaflet layer):

| Hook | Called after |
|------|--------------|
| `onLayerAdded(info, leafletLayer)` | A layer is created, and added to the map if it is visible |
| `onLayerRemoved(layerId, leafletLayer)` | A layer is removed from the map |
| `onVisibilityChanged(info, visible, leafletLayer)` | A layer is added to or removed from the map |
| `onEnabledChanged(info, enabled, leafletLayer)` | A layer is switched on or off. The map doesn't change, because visibility decides what is drawn |
| `onOpacityChanged(info, opacity, computedOpacity, leafletLayer)` | A layer's computed opacity changes and its pane has been faded |
| `onTimeInfoChanged(info, timeInfo, leafletLayer)` | A layer's time info changes. The map doesn't change, so use this to apply the time |
| `onLayerDataChanged(info, leafletLayer)` | A layer's `layerData` is replaced, and the factory's Leaflet layer is drawn |

**Methods** you might call yourself:

| Method | Description |
|--------|-------------|
| `getContext()` | Returns the Leaflet map |

`LayerManager` calls the adapter's other methods as layers change. When the adapter is detached, replaced, or the manager is destroyed, it removes every layer and pane it added from the map.

## `createDefaultLeafletFactory<TLayer>()`

Returns the default factory, which uses `layerData.leafletLayer` when present and otherwise returns `null`.
