# @ulm/core

## `new LayerManager<TLayer, TGroup>(options?)`

`TLayer` is the type of `layerData` stored on each layer. `TGroup` is the type stored on each group, and defaults to `undefined`. The manager starts as soon as it is constructed.

**Options** (all optional):

| Option | Type | Description |
|--------|------|-------------|
| `allowNestedGroupLayers` | `boolean` | Allow groups inside other groups (default `false`) |
| `inspect` | `Observer<InspectionEvent> \| (event) => void` | Receives XState inspection events |
| `onLayerAdded` | `(info) => void` | A layer or group was added |
| `onLayerRemoved` | `(layerId) => void` | A layer or group was removed, including by `reset()` |
| `onVisibilityChanged` | `(info, visible) => void` | A layer or group started or stopped showing |
| `onEnabledChanged` | `(info, enabled) => void` | A layer or group was switched on or off, including while a group above hides it |
| `onOpacityChanged` | `(info, computedOpacity) => void` | A layer's computed opacity changed |
| `onTimeInfoChanged` | `(info, timeInfo) => void` | A layer's time info changed |
| `onLayerDataChanged` | `(info) => void` | A layer's `layerData` was replaced |
| `onOrderChanged` | `(layerOrder) => void` | The order changed; receives every layer ID, bottom to top, with each group followed by its children |
| `onLayerMoved` | `(info) => void` | A layer or group was moved, raised or lowered; `info.parentId` is its new parent |
| `onError` | `(error) => void` | A change was rejected, such as an unknown layer ID or an opacity outside 0 to 1; `error.message` says why |

## Methods

| Method | Description |
|--------|-------------|
| `addLayer(params)` | Add a layer. See [Add parameters](#add-parameters) |
| `addGroup(params)` | Add a group. See [Add parameters](#add-parameters) |
| `removeLayer(layerId)` | Remove a layer or an empty group |
| `moveLayer(layerId, target)` | Move a layer or group. See [Move target](#move-target) |
| `raiseLayer(layerId)` | Move a layer or group one step towards the top of its parent |
| `lowerLayer(layerId)` | Move a layer or group one step towards the bottom of its parent |
| `setEnabled(layerId, enabled)` | Switch a layer or group on or off. Switching a layer on also switches on the groups above it |
| `showLayer(layerId)` | Make a layer or group visible by switching on it and every group above it, even if it is already switched on. See [Showing a layer](../visibility-and-opacity#showing-a-layer) |
| `setOpacity(layerId, opacity)` | Set a layer's or group's own opacity, from 0 to 1 |
| `setTimeInfo(layerId, timeInfo)` | Set a layer's or group's time info |
| `updateLayerData(layerId, layerData)` | Replace a layer's or group's `layerData` |
| `getTree()` | The layer tree: every layer and group as plain data. See [Layer tree](#layer-tree) |
| `subscribe(listener)` | Call `listener` whenever the manager or a layer may have changed. Returns a function that stops the calls. Read `getTree()` for the result |
| `setAdapter(adapter \| null)` | Attach an adapter, replacing any existing one, or detach it with `null` |
| `reset()` | Remove every layer and group, reporting each removal and the empty order |
| `destroy()` | Detach the adapter and stop the manager, without reporting the removals. The instance can't be used again, and calling `destroy()` again does nothing |

## Properties

| Property | Description |
|----------|-------------|
| `actor` | The manager's XState actor. Experimental. See [Working with XState](../xstate) |
| `destroyed` | `true` after `destroy()` |

## Layer tree

`getTree()` returns `{ rootIds, layers }`:

| Field | Description |
|-------|-------------|
| `rootIds` | The IDs of the top-level layers and groups, bottom first |
| `layers` | Every layer and group by ID, as [layer info](#layer-info). A group's `childIds` lists its children, bottom first |

The tree is read-only. The manager returns the same object until something changes, and a layer that didn't change keeps the same info object. That suits React's `useSyncExternalStore`, with no XState needed:

```ts
function useLayerTree() {
  return useSyncExternalStore(manager.subscribe, manager.getTree);
}
```

## Add parameters

`addLayer(params)` and `addGroup(params)` take:

| Param | Type | Description |
|-------|------|-------------|
| `layerConfig` | `LayerConfig` / `LayerGroupConfig` | The layer or group (see below) |
| `visible` | `boolean` | Switch it on and switch on every group above it, so it shows straight away |
| `enabled` | `boolean` | Switch it on, without switching on the groups above it |
| `position` | `'top' \| 'bottom'` | Place it at the top or bottom of its parent (default `'bottom'`) |
| `index` | `number` | Place it at this index in its parent's order, 0 being the bottom. An index past either end places it at the top or bottom. Takes precedence over `position` |

With neither `visible` nor `enabled`, it is added switched off.

`layerConfig` fields:

| Field | Type | Description |
|-------|------|-------------|
| `layerId` | `string` | Unique ID |
| `layerName` | `string` | Display name |
| `layerType` | `'layer' \| 'layerGroup'` | Which kind of item this is |
| `parentId` | `string \| null` | The ID of the group it belongs to. Leave it out, or use `null`, for the top level |
| `layerData` | `TLayer` / `TGroup` | Your data for this layer or group. Optional when its type allows `undefined`, as for groups by default |
| `opacity` | `number` | Its own opacity, from 0 to 1 (default `1`) |
| `timeInfo` | `LayerTimeInfo` | Optional single date or date range |
| `listMode` | `'show' \| 'hide'`, plus `'hide-children'` for groups | A hint for your layer list. The manager stores it but doesn't act on it (default `'show'`) |

## Move target

`moveLayer(layerId, target)` takes:

| Field | Type | Description |
|-------|------|-------------|
| `parentId` | `string \| null` | The group to move into, or `null` for the top level. It can be the layer's current parent |
| `index` | `number` | Where the layer ends up in its parent's order, 0 being the bottom, counted once the layer has left its old place. An index past either end places it at the top or bottom. Takes precedence over `position` |
| `position` | `'top' \| 'bottom'` | The top or bottom of the parent (default `'bottom'`) |

## Layer info

Callbacks and adapters receive a `ManagedLayerInfo`:

| Field | Description |
|-------|-------------|
| `layerId`, `layerName`, `layerType`, `layerData`, `listMode`, `timeInfo` | From the layer's config and later updates |
| `parentId` | The parent group's ID, or `null` |
| `enabled` | Whether it is switched on |
| `visible` | Whether it is actually showing |
| `opacity` | Its own opacity |
| `computedOpacity` | Its opacity combined with every group above it; use this on the map |
| `childIds` | Groups only: the IDs of its children, bottom first |

## Adapter interface

Implement `LayerManagerAdapter` and attach it with `manager.setAdapter()`. Every method is optional. See [Writing an adapter](../adapters/writing-an-adapter).

| Method | Called when |
|--------|-------------|
| `register()` | The adapter is attached, before it is told about existing layers |
| `unregister()` | The adapter is detached, replaced, or the manager is destroyed |
| `onLayerAdded(info)` | A layer or group was added, or already exists when the adapter is attached |
| `onLayerRemoved(layerId)` | A layer or group was removed |
| `onVisibilityChanged(info, visible)` | A layer or group started or stopped showing |
| `onEnabledChanged(info, enabled)` | A layer or group was switched on or off, including while a group above hides it |
| `onOpacityChanged(info, computedOpacity)` | A layer's computed opacity changed |
| `onTimeInfoChanged(info, timeInfo)` | A layer's time info changed |
| `onLayerDataChanged(info)` | A layer's `layerData` was replaced |
| `onOrderChanged(layerOrder)` | The order changed, or the adapter was attached; every layer ID, bottom to top |
| `onLayerMoved(info)` | A layer or group was moved, raised or lowered. Called after `onOrderChanged` |

## Emitted events

Experimental, for [working with XState](../xstate) directly. The manager actor emits these events, typed as `LayerManagerEmittedEvent`. Listen to them with `manager.actor.on(type, handler)`:

| Event | Payload |
|-------|---------|
| `LAYER.ADDED` | `layerId`. A layer that starts visible follows with `LAYER.VISIBILITY_CHANGED` |
| `LAYER.REMOVED` | `layerId` |
| `LAYER.VISIBILITY_CHANGED` | `layerId`, `visible` |
| `LAYER.ENABLED_CHANGED` | `layerId`, `enabled` |
| `LAYER.OPACITY_CHANGED` | `layerId`, `opacity`, `computedOpacity` |
| `LAYER.TIME_INFO_CHANGED` | `layerId`, `timeInfo` |
| `LAYER.LAYER_DATA_CHANGED` | `layerId`, `layerData` |
| `LAYER.ORDER_CHANGED` | `layerOrder`: every layer ID, bottom to top |
| `LAYER.MOVED` | `layerId`, `parentId`. Emitted after `LAYER.ORDER_CHANGED` |
| `LAYER.REJECTED` | `layerId`, `reason` |

## Commands

Experimental, for [working with XState](../xstate) directly. Send these events to a layer or group actor, typed as `LayerCommandEvent<TData>`:

| Event | Payload |
|-------|---------|
| `LAYER.ENABLED` / `LAYER.DISABLED` | None |
| `LAYER.SHOW` | None |
| `LAYER.SET_OPACITY` | `opacity`, from 0 to 1 |
| `LAYER.SET_TIME_INFO` | `timeInfo` |
| `LAYER.SET_LAYER_DATA` | `layerData` |

Send these events to the manager actor, typed as `LayerManagerEvent<TLayer, TGroup>`:

| Event | Payload |
|-------|---------|
| `LAYER.ADD` | `params`: see [Add parameters](#add-parameters) |
| `LAYER.REMOVE` | `layerId` |
| `LAYER.MOVE` | `layerId`, `parentId`, `index?`, `position?` |
| `RESET` | None |

A command that cannot be carried out, such as an opacity outside 0 to 1 or an unknown layer ID, is ignored. The manager then emits `LAYER.REJECTED` with the reason.

## For adapters that render layers

The Leaflet and MapLibre adapters share these types and extend the `RenderAdapter` class, so their options take the same shape and follow the same rules. They are not part of `LayerManagerAdapter`. Use them if you write an adapter of your own that shows each layer with a `renderLayer` function. See [Writing an adapter](../adapters/writing-an-adapter#showing-layers-with-renderlayer).

| Type | Description |
|------|-------------|
| `RenderLayer<TLayer, TMap, TRendered>` | `(info, map, current?) => TRendered \| null`: returns what the adapter shows for a layer, or `null` to leave it off the map. Called when a layer is added, and again when its `layerData` or `timeInfo` changes, with what it returned last time as `current` |
| `RenderAdapterArgs<TLayer, TOptions, TDefaultData>` | The adapter constructor's options argument: optional when every layer's data is `TDefaultData`, the shape its default `renderLayer` shows, and required with `renderLayer` otherwise, so a mismatch fails to compile |
| `RenderAdapterOptions<TLayer, TMap, TRendered>` | `{ renderLayer?, disposeLayer? }`. `disposeLayer(rendered, layerId)` undoes setup for something `renderLayer` returned, once the adapter discards it: when its layer is removed, when `renderLayer` returns something different, and when the adapter is detached |

### `RenderAdapter<TLayer, TGroup, TMap, TRendered>`

An abstract `LayerManagerAdapter` that calls `renderLayer` and `disposeLayer` by the rules above. It skips groups, and keeps each layer's visibility, computed opacity and place in the order. Its constructor takes `(map, { renderLayer, disposeLayer? })`, with `renderLayer` required: pass the adapter's default when the app gives none. The map is then `this.map`.

A subclass implements these methods. Each `layer` is a `RenderedLayer<TRendered>`: `{ layerId, rendered, visible, computedOpacity }`, where `rendered` is what `renderLayer` returned.

| Method | Called when |
|--------|-------------|
| `placeLayer(layer, previous?)` | A result is to go on the map: when a layer is added, when `renderLayer` returns something new, and from `placeAll()`. `previous` is the result it replaces, if any |
| `eraseLayer(layerId, rendered, next?)` | A result is to come off the map: when its layer is removed, when it is replaced, and when the adapter is detached. `next` is the result that replaces it, if any |
| `setLayerVisible(layer)` | A layer starts or stops showing |
| `setLayerOpacity(layer)` | A layer's computed opacity changes |
| `restackLayers(bottomToTop)` | The order changes, and after a replaced result is placed. Lists only the layers with a result |

| Protected member | Description |
|------------------|-------------|
| `isSame(previous, next)` | Override to say `next` stands in for `previous`: `previous` is not disposed of, and the layer is not restacked. Returns `false` unless overridden |
| `renderedLayers()` | Every layer with a result. While `eraseLayer` runs it leaves out the result being erased; while `placeLayer` runs it includes the result being placed |
| `placeAll()` | Calls `placeLayer` for every layer with a result, then `restackLayers`. For a map that lost them |

A subclass that overrides `unregister` calls `super.unregister()`, which erases and disposes of every result.

## Helper functions

`isSingleTimeInfo` and `isRangeTimeInfo` are stable. The other helpers work with the actors, and are experimental.

| Function | Description |
|----------|-------------|
| `createLayerManagerMachine()` | Create the manager machine yourself, without the `LayerManager` class |
| `connectAdapter(managerActor, adapter)` | Attach an adapter to a manager actor: replay its layers, then report every change. Returns a function that disconnects it |
| `findManagedLayerById(layers, layerId)` | Find a managed item in the manager's `layers`, for example inside a selector |
| `findLayerPlacement(context, layerId)` | Where a layer sits: `{ parentId, index, siblingCount }`, counting from the bottom |
| `getMoveLayerRejection(context, move)` | Why a move would be rejected, or `undefined` if it would succeed. Useful for checking a drop before making it |
| `isLayerMachine(actor)` / `isLayerGroupMachine(actor)` | Check whether an actor is a layer or a group |
| `isSingleTimeInfo(timeInfo)` / `isRangeTimeInfo(timeInfo)` | Check whether time info is a single date or a range |
