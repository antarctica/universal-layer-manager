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
| `getLayer(layerId)` | Return the managed item, `{ type, layerActor }`, or `undefined` |
| `setAdapter(adapter \| null)` | Attach an adapter, replacing any existing one, or detach it with `null` |
| `reset()` | Remove every layer and group, reporting each removal and the empty order |
| `destroy()` | Detach the adapter and stop the manager, without reporting the removals. The instance can't be used again |

## Properties

| Property | Description |
|----------|-------------|
| `layers` | The top-level items in order, bottom first |
| `actor` | The manager's XState actor. See [Working with XState](../xstate) |
| `isReady` | `true` while the manager is running |
| `destroyed` | `true` after `destroy()` |

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
| `parentId` | `string \| null` | The ID of the group it belongs to, or `null` for the top level |
| `layerData` | `TLayer` / `TGroup` | Your data for this layer or group |
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

## Adapter interface

Implement `LayerManagerAdapter` and attach it with `manager.setAdapter()`. Every method is optional. See [Writing an adapter](../adapters/writing-an-adapter).

| Method | Called when |
|--------|-------------|
| `register(manager, callbacks)` | The adapter is attached. `callbacks.getSnapshot()` returns the top-level items and `callbacks.getLayer(id)` returns one item |
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

For [working with XState](../xstate) directly. The manager actor emits these events, which you can listen to with `manager.actor.on(type, handler)`:

| Event | Payload |
|-------|---------|
| `LAYER.ADDED` | `layerId`, `visible` |
| `LAYER.REMOVED` | `layerId` |
| `LAYER.VISIBILITY_CHANGED` | `layerId`, `visible` |
| `LAYER.ENABLED_CHANGED` | `layerId`, `enabled` |
| `LAYER.OPACITY_CHANGED` | `layerId`, `opacity`, `computedOpacity` |
| `LAYER.TIME_INFO_CHANGED` | `layerId`, `timeInfo` |
| `LAYER.LAYER_DATA_CHANGED` | `layerId`, `layerData` |
| `LAYER.ORDER_CHANGED` | `layerOrder`: every layer ID, bottom to top |
| `LAYER.MOVED` | `layerId`, `parentId`. Emitted after `LAYER.ORDER_CHANGED` |
| `LAYER.REJECTED` | `layerId`, `reason` |

## Helper functions

| Function | Description |
|----------|-------------|
| `createLayerManagerMachine()` | Create the manager machine yourself, without the `LayerManager` class |
| `findManagedLayerById(layers, layerId)` | Find a managed item in the manager's `layers`, for example inside a selector |
| `getLayerDataFromLayerId(layers, layerId)` | Read an item's `layerData` from the manager's `layers` |
| `getTopLevelLayersInOrder(childLayerOrder, layers)` | Turn the manager's top-level order into a list of managed items |
| `getLayerGroupChildrenInOrder(childLayerOrder, children)` | Turn a group's order into a list of its child actors |
| `getFlatLayerOrder(context)` | Every layer ID, bottom to top, with each group followed by its children |
| `findLayerPlacement(context, layerId)` | Where a layer sits: `{ parentId, index, siblingCount }`, counting from the bottom |
| `getMoveLayerRejection(context, move)` | Why a move would be rejected, or `undefined` if it would succeed. Useful for checking a drop before making it |
| `isLayerMachine(actor)` / `isLayerGroupMachine(actor)` | Check whether an actor is a layer or a group |
| `isSingleTimeInfo(timeInfo)` / `isRangeTimeInfo(timeInfo)` | Check whether time info is a single date or a range |
