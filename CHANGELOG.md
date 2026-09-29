# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`@ulm/core` and `@ulm/leaflet` ship on the same version. The scope on each
entry names the package that changed.

Sections are drafted from the commit history with `npm run changelog:draft` and
edited before release. To see what is pending, run `npm run changelog:preview`.

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
