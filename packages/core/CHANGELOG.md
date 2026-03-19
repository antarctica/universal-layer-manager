
# @ulm/core changelog

All notable changes to `@ulm/core` are documented in this file.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-19

Initial release as `@ulm/core`, extracted from `@ulm/universal-layer-manager`.

### Added

- `LayerManager<TLayer, TGroup>` class as the primary public API over the XState machine
- `LayerManagerAdapter<TLayer, TGroup>` interface for push-model adapter integration
- `ManagedLayerInfo` — stable, non-XState shape passed to adapter methods and option callbacks
- `LayerManagerCallbacks` — read-only callbacks (`getSnapshot`, `getLayer`) passed to adapters on registration
- `setTimeInfo`, `onTimeInfoChanged`, and `enabled` on `LayerManager`
