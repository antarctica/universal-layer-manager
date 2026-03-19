---
title: Examples
group: Documentation
---

# Example Implementations

This library includes several example implementations demonstrating different ways to use the Universal Layer Manager library. Each example is available in the [GitHub repository](https://github.com/antarctica/universal-layer-manager).

## Simple - React

**Source Code:** [`examples/simple`](https://github.com/antarctica/universal-layer-manager/tree/main/examples/simple)

A minimal React example demonstrating basic layer manager usage without any map integration. This is the simplest way to get started with the library.

**Key features:**
- Uses `createLayerManagerMachine()` from `@ulm/core` to create a layer manager machine
- Uses `LayerManagerProvider` to provide the layer manager context to React components via XState's actor context
- Demonstrates managing layers and layer groups in a simple UI
- Uses React hooks to subscribe to layer state changes and update the UI accordingly
- Shows how to add layers, layer groups, and adjust opacity without any map library dependencies

## Leaflet - React

**Source Code:** [`examples/leaflet`](https://github.com/antarctica/universal-layer-manager/tree/main/examples/leaflet)

A React + Leaflet example demonstrating how to integrate the @ulm/core with Leaflet maps. This shows how to sync layer manager state with actual map layers.

**Key features:**
- Uses `createLayerManagerMachine()` from `@ulm/core` wrapped in `createActorContext()` to create a layer manager machine
- Uses `LayerManagerProvider` to provide the layer manager context to React components via XState's actor context
- Integrates with Leaflet maps by syncing layer manager state (visibility, opacity) with Leaflet layers
- Demonstrates managing tile layers and markers through the layer manager
- Uses event subscriptions to sync layer visibility and opacity changes between the layer manager and Leaflet map
- Shows how to handle nested layer groups with map layers
