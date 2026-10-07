# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`@ulm/core`, `@ulm/leaflet` and `@ulm/maplibre` ship on the same version. The scope on each
entry names the package that changed.

Sections are drafted from the commit history with `npm run changelog:draft` and
edited before release. To see what is pending, run `npm run changelog:preview`.

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
