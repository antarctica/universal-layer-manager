# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`@ulm/core`, `@ulm/leaflet`, `@ulm/maplibre` and `@ulm/arcgis` ship on the same version. The scope on each
entry names the package that changed.

Sections are drafted from the commit history with `npm run changelog:draft` and
edited before release. To see what is pending, run `npm run changelog:preview`.

## [3.1.0] - 2026-10-08

### Added

- **arcgis**: New `@ulm/arcgis` package with `ArcGISLayerManagerAdapter`, which shows each layer as an ArcGIS Maps SDK for JavaScript layer
  - Keeps every layer in one `GroupLayer`, which it adds to the top of the map and hides from ArcGIS layer lists. Layers added outside the manager keep their places
  - The `container` option keeps the layers in a `GroupLayer` the app has already placed on the map
  - Sets each layer's `visible` and `opacity`, using the opacity combined with its groups, and stacks the layers in the manager's order
  - `renderLayer` returns the ArcGIS layer to show for a layer. Without it, `defaultArcGISRenderLayer` shows `layerData.arcgisLayer`
  - When detached, takes its layers off the map, and the group too if it created it. It never destroys layers; use `disposeLayer` for that
  - Needs `@arcgis/core` 5, and like it, is published as ES modules only
- **examples**: React ArcGIS example, set in Antarctica on the BAS basemap, with a time-aware AMSR2 sea ice layer
- **examples**: Stack the map above the layer list on small screens

### Fixed

- **examples**: Keep layer rows on one line and truncate long layer names

[3.1.0]: https://github.com/antarctica/universal-layer-manager/compare/v3.0.0...v3.1.0

## [3.0.0] - 2026-10-07

### Migrating from 2.x

**Read layers from `getTree()`.** `LayerManager.layers` and `LayerManager.getLayer()` are removed. `getTree()` returns `{ rootIds, layers }`: the top-level IDs, bottom first, and every layer and group by ID as plain data. It returns the same object until something changes, so it works with `useSyncExternalStore` alongside `subscribe()`.

**`stop()` and `isReady` are removed.** Use `destroy()`, which is now safe to call twice, and `destroyed`.

**The group data type defaults to `undefined`.** It used to default to the layer data type. If your groups carry data, pass its type: `LayerManager<LayerData, GroupData>`. `LayerInfo` and `LayerGroupInfo` now take only their own data type: `LayerInfo<TLayer>` and `LayerGroupInfo<TGroup>`.

**Leaflet: `layerFactory` is now `renderLayer`, and the `hooks` option is removed.** `renderLayer` runs when a layer is added, and again when its `layerData` or `timeInfo` changes, with the Leaflet layer it returned last time as `current`. Return `current` to keep that layer, or return a new one to replace it. Use `disposeLayer` to undo what `renderLayer` set up, and the manager's callbacks for anything else.

```ts
// 2.x
new LeafletLayerManagerAdapter(map, {
  layerFactory: (info) => L.tileLayer(info.layerData.url),
  hooks: { onLayerDataChanged: (info, layer) => (layer as L.TileLayer).setUrl(info.layerData.url) },
});
```

```ts
// 3.0
new LeafletLayerManagerAdapter<LayerData>(map, {
  renderLayer: (info, _map, current) => {
    if (current instanceof L.TileLayer) {
      current.setUrl(info.layerData.url);
      return current;
    }
    return L.tileLayer(info.layerData.url);
  },
});
```

The options are now required unless every layer's data is `{ leafletLayer }`, which the default shows. `createDefaultLeafletFactory()` is now `defaultLeafletRenderLayer`, a function you call from your own `renderLayer` for the layers you don't handle. `getContext()` is removed: use the map you passed to the constructor.

**Install `@ulm/core` yourself.** `@ulm/leaflet` lists it as a peer dependency, `^3.0.0`.

**If you write your own adapter:**

- `register()` takes no arguments, and `LayerManagerCallbacks` is no longer exported.
- A layer added as visible arrives hidden in `onLayerAdded`, then `onVisibilityChanged` shows it.
- To show each layer with a `renderLayer` function, extend `RenderAdapter` and implement only the map calls.

**If you work with the XState actors directly:**

- `LAYER.ADDED` no longer has a `visible` field. The layer follows with `LAYER.VISIBILITY_CHANGED`.
- `LayerGroupConfig` takes only the group data type, and the machine types no longer default `TGroup` to `TLayer`.
- The events, refs, snapshots and context types the actors use between themselves are no longer exported: `ChildEvent`, `ParentEvent`, `LayerEvent`, `LayerGroupEvent`, `LayerEventBase`, `LayerManagerChildEvent`, `LayerManagerRef`, `ParentLayerActor`, `ParentLayerSnapshot`, `ChildLayerActor`, `ChildLayerSnapshot`, `LayerContextBase`, `LayerContext`, `LayerGroupContext`, `LayerManagerContext` and `LayerStartState`. Type commands with `LayerCommandEvent`.
- `getLayerDataFromLayerId`, `getTopLevelLayersInOrder` and `getLayerGroupChildrenInOrder` are removed. Read `getTree()` or the actor snapshots.

### Added

- **maplibre**: New `@ulm/maplibre` package with `MapLibreLayerManagerAdapter`, which shows each layer as MapLibre sources and style layers
  - `renderLayer` returns a layer's style, under the source and style layer IDs it chooses. Layers that name the same source share it. Without `renderLayer`, `defaultMapLibreRenderLayer` draws `layerData` that is already a style
  - A style that changes only GeoJSON data or tile URLs updates its sources in place, so the old features and tiles show until the new ones load
  - Hides layers with layout visibility. Fades fill and line layers with their layer opacity, and other types by scaling their own opacity properties
  - Draws layers in the manager's order below the map's first label layer, or below the `drawBelow` style layer
  - Adds layers added while the style loads once it loads, and draws them again after `map.setStyle()`
  - Refuses a layer whose IDs the map already has from someone else, such as the basemap, and reports it as a map `error` event. Leaves sources and style layers it did not add on the map
- **core**: `showLayer(layerId)` switches a layer on along with every group above it
- **core**: `onEnabledChanged` reports a layer or group being switched on or off, even while a group above hides it
- **core**: `getTree()` and `subscribe()` to read every layer and group as plain data
- **core**: Group info has `childIds`, bottom first
- **core**: `RenderAdapter` base class for adapters that show each layer with a `renderLayer` function. It calls `renderLayer` and `disposeLayer` and tracks visibility, opacity and order, so a subclass only changes the map. Shared types: `RenderLayer`, `RenderAdapterOptions`, `RenderAdapterArgs` and `RenderedLayer`
- **core**: `LayerManagerHooks`, the hooks shared by adapters and the `LayerManager` options
- **core**: `LayerCommandEvent`, the commands a layer or group actor accepts
- **core**: `connectAdapter` attaches an adapter to a manager actor (experimental)
- **core**: `parentId` is optional and defaults to the top level. `layerData` is optional when its type allows `undefined`. Layers accept `listMode`
- **leaflet**: `renderLayer` runs again when a layer's `layerData` or `timeInfo` changes, with the Leaflet layer drawn last time as `current`
- **leaflet**: `disposeLayer` option
- **examples**: React MapLibre example. The Leaflet example reads the layer tree

### Changed

- **core**: `LayerManager.actor` and `createLayerManagerMachine` are marked experimental
- **Breaking:** **leaflet**: `layerFactory` is renamed to `renderLayer`, `LeafletLayerFactory` to `LeafletRenderLayer` and `createDefaultLeafletFactory()` to `defaultLeafletRenderLayer`
- **Breaking:** **leaflet**: Options are required unless every layer's data is `LeafletLayerData`
- **leaflet**: `@ulm/core` is a peer dependency, `^3.0.0`

### Removed

- **Breaking:** **core**: `LayerManager.layers` and `LayerManager.getLayer()`
- **Breaking:** **core**: `LayerManager.stop()` and `LayerManager.isReady`
- **Breaking:** **core**: `LayerManagerCallbacks`, and the arguments to `register()`
- **Breaking:** **core**: Internal actor types and the helpers listed in the migration notes
- **Breaking:** **leaflet**: The `hooks` option and `LeafletAdapterHooks`
- **Breaking:** **leaflet**: `getContext()`

### Fixed

- **Breaking:** **core**: A layer added as visible arrives hidden, then shows with a visibility change, so adapters see one order every time
- **Breaking:** **core**: The group data type defaults to `undefined`, not the layer data type
- **core**: `destroy()` can be called twice. `setAdapter()` on a destroyed manager reports through `onError`
- **core**: Reject opacity outside 0 to 1, when adding a layer and when setting it
- **core**: Clamp out-of-range layer indexes
- **core**: Report nothing for a change that leaves a value as it was: the same opacity, equal time info, a computed opacity that did not change, or a move that leaves parent and order unchanged
- **core**: Report unknown layer IDs through `onError` from every method
- **core**: Call the options callback even when an adapter hook throws
- **leaflet**: Remove a layer's pane when the layer is removed, and every pane the adapter added when it is detached
- **examples**: Use one copy of React in the Leaflet example
- **examples**: Redraw the simple layer list when a layer is switched on or off

[3.0.0]: https://github.com/antarctica/universal-layer-manager/compare/v2.0.0...v3.0.0

## [2.0.0] - 2026-10-01

### Migrating from 1.x

**Time info uses Temporal.** Dates in `timeInfo` are now `Temporal.PlainDate`, `Temporal.PlainDateTime` or `Temporal.ZonedDateTime`, in place of `CalendarDate`, `CalendarDateTime` and `ZonedDateTime` from `@internationalized/date`. Not every browser supports Temporal yet, so install `temporal-polyfill` and import `Temporal` from it:

```ts
// 1.x
import { parseDate } from '@internationalized/date';

manager.setTimeInfo('sea-ice', { type: 'single', precision: 'date', value: parseDate('2026-10-01') });
```

```ts
// 2.0
import { Temporal } from 'temporal-polyfill';

manager.setTimeInfo('sea-ice', { type: 'single', precision: 'date', value: Temporal.PlainDate.from('2026-10-01') });
```

**`setVisibility` is removed.** Use `setEnabled(layerId, enabled)`. In 1.x the two did the same thing.

**If you work with the XState actors directly:**

- A switched-off layer's snapshot value is `'disabled'`, not `{ disabled: 'hidden' }`. Check it with `snapshot.matches('disabled')` or `snapshot.hasTag('enabled')`.
- `LayerMachineActor`, `LayerGroupMachineActor` and `LayerActor` default their data types to `unknown` rather than `any`. Pass your types, for example `LayerActor<LayerData, GroupData>`.
- `LAYER.UPDATE_VISIBILITY`, `LAYER.UPDATE_OPACITY`, `LAYER.UPDATE_TIME_INFO` and `LAYER.UPDATE_LAYER_DATA` are renamed to `CHILD.*_CHANGED` and are internal. To change a layer, send `LAYER.ENABLED`, `LAYER.DISABLED`, `LAYER.SET_OPACITY`, `LAYER.SET_TIME_INFO` or `LAYER.SET_LAYER_DATA` to its actor. To react to changes, listen for the manager's `LAYER.*_CHANGED` events.

### Added

- Add enabled and visible state tags to layer machines
- **core**: Report layer order changes to adapters and callbacks
- **core**: Add onLayerDataChanged option to LayerManager
- **core**: Add inspect option to LayerManager
- **core**: Move, raise and lower layers within their parent
- **core**: Reject moving a layer that does not exist
- **core**: Reject moving a layer into a parent that is not a group
- **core**: Reject moving a group into itself or a descendant
- **core**: Reject moving a group into a group unless nesting is allowed
- **core**: Report moved layers through onLayerMoved
- **core**: Move a layer from one group into another
- **core**: Recompute computed opacity when a layer changes group
- **core**: Report opacity after a move only when it changes
- **core**: Hide a layer moved into a group that is not showing
- **core**: Show a switched-on layer moved into a showing group
- **core**: Carry group visibility through a move
- **core**: Update a moved group's layers to its new computed opacity
- **leaflet**: Stack every layer in the manager's order with panes
- **leaflet**: Fade every kind of layer through its pane
- **examples**: Reorder layers by drag and drop in the Leaflet example
- **core**: Tell a newly attached adapter about existing layers
- **Breaking:** **core**: Stop exporting internal helpers
- **Breaking:** **core**: Use Temporal types for layer time info

### Removed

- **Breaking:** **core**: Remove internal helpers from the published types

### Fixed

- Stop layer actors and emit removals on reset
- Report current computed opacity for nested groups
- Emit LAYER.ADDED visibility from the added layer's state
- **core**: Start layers and groups in their resolved state from input
- **core**: Queue parent group updates as actions when adding or removing
- **core**: Guard add and remove transitions and report rejections
- **core**: Compute layer opacity from parent messages, not snapshots
- **Breaking:** **core**: Own group child order in the layer manager
- **Breaking:** **core**: Separate child notifications from manager commands
- **leaflet**: Make leaflet a peer dependency

### Refactor

- **Breaking:** **core**: Remove unused validation and opacity helpers
- **Breaking:** **core**: Default layer actor types to unknown instead of any
- **Breaking:** **core**: Make the disabled state atomic in layer machines
- **Breaking:** **core**: Remove setVisibility in favour of setEnabled

[2.0.0]: https://github.com/antarctica/universal-layer-manager/compare/v1.0.0...v2.0.0

## [1.0.0] - 2026-03-19

Initial release of `@ulm/core` and `@ulm/leaflet`, extracted from `@ulm/universal-layer-manager`.

### Added

- **core**: `LayerManager<TLayer, TGroup>` class as the primary public API over the XState machine
- **core**: `LayerManagerAdapter<TLayer, TGroup>` interface for push-model adapter integration
- **core**: `ManagedLayerInfo` — stable, non-XState shape passed to adapter methods and option callbacks
- **core**: `LayerManagerCallbacks` — read-only callbacks (`getSnapshot`, `getLayer`) passed to adapters on registration
- **core**: `setTimeInfo`, `onTimeInfoChanged`, and `enabled` on `LayerManager`
- **leaflet**: Initial Leaflet adapter for `@ulm/core`, including a factory for creating a Leaflet-backed layer manager
- **leaflet**: Type-safe bindings between Leaflet layers and the `@ulm/core` layer configuration

[1.0.0]: https://github.com/antarctica/universal-layer-manager/compare/v1.0.2...v1.0.0
