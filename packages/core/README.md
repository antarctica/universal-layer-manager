<img src="./assets/universal-layer-manager.svg" alt="Universal Layer Manager logo" width="160" />

# @ulm/core

[![npm version](https://img.shields.io/npm/v/@ulm/core.svg)](https://www.npmjs.com/package/@ulm/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)

State-machine-powered layer management for map applications. Framework-agnostic core library built on [XState](https://xstate.js.org/).

## Installation

```bash
npm install @ulm/core
```

## Quick start

`LayerManager` is the primary public API. It wraps the XState machines and starts automatically on construction.

```ts
import type { AddGroupLayerParams, AddLayerParams } from '@ulm/core';
import { LayerManager } from '@ulm/core';

interface LayerData {
  url: string;
}

interface GroupData {
  category: string;
}

const manager = new LayerManager<LayerData, GroupData>({
  allowNestedGroupLayers: true,

  onLayerAdded(info) {
    console.log('added:', info.layerId);
  },
  onVisibilityChanged(info, visible) {
    console.log(info.layerId, 'visible:', visible);
  },
  onOpacityChanged(info, computedOpacity) {
    console.log(info.layerId, 'opacity:', computedOpacity);
  },
});

// Add a layer
manager.addLayer({
  layerConfig: {
    layerId: 'basemap',
    layerName: 'Basemap',
    layerType: 'layer',
    parentId: null,
    layerData: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
  },
  visible: true,
});

// Add a group with a child layer
manager.addGroup({
  layerConfig: {
    layerId: 'overlays',
    layerName: 'Overlays',
    layerType: 'layerGroup',
    parentId: null,
    layerData: { category: 'overlays' },
  },
  visible: true,
});

manager.addLayer({
  layerConfig: {
    layerId: 'markers',
    layerName: 'Markers',
    layerType: 'layer',
    parentId: 'overlays',
    layerData: { url: '' },
  },
  visible: true,
});

// Control layers
manager.setEnabled('basemap', false);
manager.setOpacity('markers', 0.5);
manager.removeLayer('markers');

// Teardown
manager.destroy();
```

## API

### `new LayerManager<TLayer, TGroup>(options?)`

`TLayer` is the type of `layerData` stored on each layer. `TGroup` is the type stored on each group; it defaults to `undefined`, so pass it when your groups carry data. The manager starts as soon as it is constructed.

**Options** (all optional):

| Option | Type | Description |
|--------|------|-------------|
| `allowNestedGroupLayers` | `boolean` | Allow groups inside other groups (default `false`) |
| `inspect` | `Observer<InspectionEvent> \| (event) => void` | Receives XState inspection events, for example `createBrowserInspector().inspect` from `@statelyai/inspect` |
| `onLayerAdded` | `(info) => void` | A layer or group was added |
| `onLayerRemoved` | `(layerId) => void` | A layer or group was removed, including by `reset()` |
| `onVisibilityChanged` | `(info, visible) => void` | A layer or group started or stopped showing |
| `onOpacityChanged` | `(info, computedOpacity) => void` | A layer's own opacity or a parent group's opacity changed |
| `onTimeInfoChanged` | `(info, timeInfo) => void` | A layer's time info changed |
| `onLayerDataChanged` | `(info) => void` | A layer's `layerData` was replaced |
| `onOrderChanged` | `(layerOrder) => void` | The order changed; receives every layer ID, bottom to top, with each group followed by its children |
| `onLayerMoved` | `(info) => void` | A layer or group was moved; `info.parentId` is its new parent |
| `onError` | `(error) => void` | An add, remove or move was rejected; `error.message` says why |

### Adding layers and groups

`addLayer(params)` and `addGroup(params)` take:

| Param | Type | Description |
|-------|------|-------------|
| `layerConfig` | `LayerConfig` / `LayerGroupConfig` | The layer or group (see below) |
| `enabled` | `boolean` | Switch it on. It shows if every group above it is showing, otherwise it waits, switched on but hidden |
| `visible` | `boolean` | Switch it on and switch on every group above it, so it shows straight away |
| `position` | `'top' \| 'bottom'` | Place it at the top or bottom of its parent (default `'bottom'`) |
| `index` | `number` | Place it at this index in its parent's order (0 is the bottom); takes precedence over `position` |

With neither `enabled` nor `visible`, a layer is added switched off.

`layerConfig` fields:

| Field | Type | Description |
|-------|------|-------------|
| `layerId` | `string` | Unique ID |
| `layerName` | `string` | Display name |
| `layerType` | `'layer' \| 'layerGroup'` | Which kind of item this is |
| `parentId` | `string \| null` | The ID of the group it belongs to, or `null` for the top level |
| `layerData` | `TLayer` / `TGroup` | Your data for this layer or group |
| `opacity` | `number` | Its own opacity, 0–1 (default `1`) |
| `timeInfo` | `LayerTimeInfo` | Optional single date or date range |
| `listMode` | `'show' \| 'hide'`, plus `'hide-children'` for groups | A hint for your layer list; the manager stores it but does not act on it (default `'show'`) |

An add is rejected, and reported through `onError`, when the ID is already in use, the parent group does not exist, or the item is a group inside a group while `allowNestedGroupLayers` is `false`.

### Methods

| Method | Description |
|--------|-------------|
| `addLayer(params)` | Add a layer |
| `addGroup(params)` | Add a layer group |
| `removeLayer(layerId)` | Remove a layer or an empty group. Removing an unknown ID or a group that still has children is rejected through `onError` |
| `moveLayer(layerId, target)` | Move a layer or group to `target.parentId` (`null` for the top level), at `target.index` or `target.position`. See [Moving layers](#moving-layers) |
| `raiseLayer(layerId)` | Move a layer or group one step towards the top of its parent. Does nothing at the top |
| `lowerLayer(layerId)` | Move a layer or group one step towards the bottom of its parent. Does nothing at the bottom |
| `setEnabled(layerId, enabled)` | Switch a layer or group on or off. A switched-on layer shows only while every group above it is on. Switching a layer on also switches on the groups above it |
| `setOpacity(layerId, opacity)` | Set a layer's or group's own opacity (0–1). Its computed opacity is its own opacity multiplied by its parent group's computed opacity |
| `setTimeInfo(layerId, timeInfo)` | Set the time info (`LayerTimeInfo`) for a layer or group |
| `updateLayerData(layerId, layerData)` | Replace the `layerData` for a layer or group |
| `getLayer(layerId)` | Return the managed item (`{ type, layerActor }`) for an ID, or `undefined` |
| `setAdapter(adapter \| null)` | Attach an adapter, replacing and unregistering any previous one, or detach it with `null` |
| `reset()` | Remove and stop every layer and group; reports each removal and an empty order |
| `destroy()` | Unregister the adapter, then stop every layer and the manager without reporting removals. The instance cannot be reused |
| `stop()` | Alias for `destroy()` |

### Properties

| Property | Description |
|----------|-------------|
| `layers` | Top-level items in order, bottom first |
| `actor` | The underlying XState actor, for `@xstate/react` (`useSelector`, etc.) |
| `isReady` | `true` while the manager is running |
| `destroyed` | `true` after `destroy()` |

### Layer info

Callbacks and adapters receive a `ManagedLayerInfo`:

| Field | Description |
|-------|-------------|
| `layerId`, `layerName`, `layerType`, `layerData`, `listMode`, `timeInfo` | From the layer's config and later updates |
| `parentId` | The parent group's ID, or `null` |
| `enabled` | Whether the layer is switched on |
| `visible` | Whether it is actually showing: switched on, and every group above it is showing |
| `opacity` | Its own opacity |
| `computedOpacity` | Its opacity multiplied through every group above it; use this on the map |

A layer can be `enabled: true` but `visible: false` while a group above it is switched off.

### Layer order

Order always runs bottom to top. `manager.layers` lists the top-level items. A group lists its own children, in order, on its actor:

```ts
const group = manager.getLayer('overlays');
if (group?.type === 'layerGroup') {
  const { children, childLayerOrder } = group.layerActor.getSnapshot().context;
}
```

`onOrderChanged` receives the whole tree flattened: each group followed by its children.

A layer list usually shows the top layer first, so reverse these lists when you draw them.

### Moving layers

```ts
manager.moveLayer('sea-ice', { parentId: 'forecasts', index: 2 }); // into a group, at an index
manager.moveLayer('sea-ice', { parentId: null, position: 'top' }); // to the top level, at the top
manager.raiseLayer('sea-ice'); // one step towards the top of its parent
manager.lowerLayer('sea-ice'); // one step towards the bottom of its parent
```

`target` has the same placement fields as `addLayer`:

| Field | Type | Description |
|-------|------|-------------|
| `parentId` | `string \| null` | The group to move into, or `null` for the top level. It can be the layer's current parent |
| `index` | `number` | Where the layer ends up in its parent's order, 0 being the bottom. It counts once the layer has left its old place, so moving a layer to index 2 within a parent of three puts it at the top. Takes precedence over `position`; an index outside the order is ignored and `position` is used |
| `position` | `'top' \| 'bottom'` | The top or bottom of the parent (default `'bottom'`) |

A moved group takes its children with it. After a move:

- `onOrderChanged` receives the new order, and `onLayerMoved` receives the moved layer's info.
- A layer or group that is switched on shows if its new parent is showing. Otherwise it stays switched on but hidden. A switched-off layer stays off, and a move never switches other layers on.
- Its computed opacity uses its new parent's opacity. `onOpacityChanged` is called only for layers whose computed opacity changed, including the children of a moved group.
- Switching the layer on later switches on its new groups, not its old ones.

A move is rejected, reported through `onError` and leaves the order as it was, when the layer does not exist, the target parent does not exist or is not a group, a group is moved into itself or one of its descendants, or a group is moved into a group while `allowNestedGroupLayers` is `false`.

### Debugging with the Stately Inspector

```ts
import { createBrowserInspector } from '@statelyai/inspect';

const manager = new LayerManager<LayerData>({ inspect: createBrowserInspector().inspect });
```

## Adapters

To sync the manager with a map library, implement `LayerManagerAdapter` and pass it to `manager.setAdapter()`. `LayerManager` calls the adapter's methods directly; every method is optional. See [`@ulm/leaflet`](../leaflet/README.md) for a ready-made Leaflet adapter.

| Method | Called when |
|--------|-------------|
| `register(manager, callbacks)` | The adapter is attached. `callbacks.getSnapshot()` returns the top-level items and `callbacks.getLayer(id)` returns one item |
| `unregister()` | The adapter is replaced, detached with `setAdapter(null)`, or the manager is destroyed |
| `onLayerAdded(info)` | A layer or group was added |
| `onLayerRemoved(layerId)` | A layer or group was removed |
| `onVisibilityChanged(info, visible)` | A layer or group started or stopped showing |
| `onOpacityChanged(info, computedOpacity)` | A layer's computed opacity changed |
| `onTimeInfoChanged(info, timeInfo)` | A layer's time info changed |
| `onLayerDataChanged(info)` | A layer's `layerData` was replaced |
| `onOrderChanged(layerOrder)` | The order changed; every layer ID, bottom to top |
| `onLayerMoved(info)` | A layer or group was moved; `info.parentId` is its new parent. Called after `onOrderChanged` |

## Lower-level access

`createLayerManagerMachine`, `layerMachine` and `layerGroupMachine` are exported for working with the XState actors directly. `LayerManager` exposes the same actor as `manager.actor`.

```ts
import { createLayerManagerMachine } from '@ulm/core';
import { createActor } from 'xstate';

const actor = createActor(createLayerManagerMachine<LayerData>(), {
  input: { allowNestedGroupLayers: true },
});
actor.start();
```

**Events you send to the manager:**

| Event | Description |
|-------|-------------|
| `{ type: 'LAYER.ADD', params }` | Add a layer or group; `params` as for `addLayer` / `addGroup` |
| `{ type: 'LAYER.REMOVE', layerId }` | Remove a layer or an empty group |
| `{ type: 'LAYER.MOVE', layerId, parentId, index?, position? }` | Move a layer or group; fields as for `moveLayer` |
| `{ type: 'RESET' }` | Remove and stop every layer and group |

Layer and group actors send `CHILD.*` notifications to the manager. These are internal; do not send them yourself.

**Events you send to a layer or group actor** (from `manager.getLayer(id).layerActor`):

| Event | Description |
|-------|-------------|
| `{ type: 'LAYER.ENABLED' }` / `{ type: 'LAYER.DISABLED' }` | Switch it on or off |
| `{ type: 'LAYER.SET_OPACITY', opacity }` | Set its own opacity |
| `{ type: 'LAYER.SET_TIME_INFO', timeInfo }` | Set its time info |
| `{ type: 'LAYER.SET_LAYER_DATA', layerData }` | Replace its data |

**Events the manager emits** (listen with `actor.on(type, handler)`):

| Event | Payload |
|-------|---------|
| `LAYER.ADDED` | `layerId`, `visible` |
| `LAYER.REMOVED` | `layerId` |
| `LAYER.ORDER_CHANGED` | `layerOrder`: every layer ID, bottom to top |
| `LAYER.MOVED` | `layerId`, `parentId`: its new parent, or `null`. Emitted after `LAYER.ORDER_CHANGED` |
| `LAYER.VISIBILITY_CHANGED` | `layerId`, `visible` |
| `LAYER.OPACITY_CHANGED` | `layerId`, `opacity`, `computedOpacity` |
| `LAYER.TIME_INFO_CHANGED` | `layerId`, `timeInfo` |
| `LAYER.LAYER_DATA_CHANGED` | `layerId`, `layerData` |
| `LAYER.REJECTED` | `layerId`, `reason` |

**Selecting on layer and group state:** use the tags, which do not depend on how the states are nested.

| Check | Meaning |
|-------|---------|
| `snapshot.hasTag('enabled')` | Switched on |
| `snapshot.hasTag('visible')` | Switched on and showing |
| `snapshot.matches('disabled')` | Switched off |

### Helper functions

| Function | Description |
|----------|-------------|
| `findManagedLayerById(layers, layerId)` | Find a managed item in the manager's `layers` |
| `getLayerDataFromLayerId(layers, layerId)` | Read an item's `layerData` |
| `getTopLevelLayersInOrder(childLayerOrder, layers)` | Map the manager's top-level order to managed items |
| `getLayerGroupChildrenInOrder(childLayerOrder, children)` | Map a group's order to its child actors |
| `getFlatLayerOrder(context)` | Flatten the manager's order, bottom to top, each group followed by its children |
| `findParentActor(layers, layerConfig)` | The group actor a config's `parentId` points at, or `null` |
| `findParentLayerGroupActor(layers, groupId)` | A group actor by ID, or `null` if the ID is not a group |
| `findParentGroupId(context, layerId)` | The ID of the group that holds a layer, from the manager's context |
| `findLayerPlacement(context, layerId)` | Where a layer sits: `{ parentId, index, siblingCount }`, counting from the bottom, or `undefined` |
| `getAddLayerRejection(layerConfig, context)` | Why an add would be rejected, or `undefined` |
| `getRemoveLayerRejection(layerId, context)` | Why a remove would be rejected, or `undefined` |
| `getMoveLayerRejection(context, move)` | Why a move would be rejected, or `undefined` |
| `updateLayerOrder(order, layerId, index?, position?)` | Insert an ID into an order, as `addLayer` does |
| `isValidLayerIndex(index, length)` | Whether an index can be inserted at |
| `isLayerMachine(actor)` / `isLayerGroupMachine(actor)` | Narrow a layer actor to a layer or a group |
| `isSingleTimeInfo(timeInfo)` / `isRangeTimeInfo(timeInfo)` | Narrow a `LayerTimeInfo` |

`getUpdatedLayerStructure`, `getUpdatedLayerStructureAfterRemoval`, `getUpdatedLayerStructureAfterMove` and `getGroupChildrenChangedEvent` are also exported; the manager machine uses them to update its context.

## License

MIT
