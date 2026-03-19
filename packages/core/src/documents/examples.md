---
title: Examples
group: Documentation
---

# Example Implementations

This library includes several example implementations demonstrating different ways to use the Universal Layer Manager library. Each example is available in the [GitHub repository](https://github.com/antarctica/universal-layer-manager).

## Simple - Vanilla TypeScript

**Source Code:** [`examples/simple`](https://github.com/antarctica/universal-layer-manager/tree/main/examples/simple)

A minimal vanilla TypeScript example demonstrating basic layer manager usage without any framework or map library. This is the simplest way to get started with the library.

**Key features:**
- Uses `LayerManager` from `@ulm/core` with inline option callbacks
- Renders a nested layer/group tree using plain DOM manipulation
- Responds to `onLayerAdded`, `onVisibilityChanged`, and `onOpacityChanged` callbacks to keep the UI in sync
- Shows how to add layers and layer groups, and adjust visibility and opacity without any map library dependencies

## Leaflet - React

**Source Code:** [`examples/leaflet`](https://github.com/antarctica/universal-layer-manager/tree/main/examples/leaflet)

A React + Leaflet example demonstrating how to integrate `@ulm/core` with Leaflet maps using the adapter pattern. This shows how to sync layer manager state with actual map layers.

**Key features:**
- Uses `LayerManager` from `@ulm/core` exposed via a React context provider
- Uses `@xstate/react` selectors (via `manager.actor`) to subscribe components to actor state
- Attaches `LeafletLayerManagerAdapter` from `@ulm/leaflet` via `manager.setAdapter()` to sync visibility and opacity with Leaflet layers
- Demonstrates managing tile layers and markers through the layer manager
- Shows how to handle nested layer groups with map layers
