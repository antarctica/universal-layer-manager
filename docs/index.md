---
layout: home

hero:
  name: Universal Layer Manager
  tagline: State-machine-powered layer management for any map library and UI framework.
  image:
    src: /logo.svg
    alt: Universal Layer Manager logo
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: API reference
      link: /reference/core
    - theme: alt
      text: View on GitHub
      link: https://github.com/antarctica/universal-layer-manager

---

Universal Layer Manager is a TypeScript library for managing web map layers independently of any specific map library or UI framework. For example, you can build a single layer list component and use it with Leaflet in one project and ArcGIS Maps SDK for JavaScript in another, without changing your state logic.

The library provides a central store for your map's layer hierarchy: individual layers and nested groups, visibility and opacity, drawing order, and optional temporal metadata. Every update flows through this store, keeping layer behaviour consistent however a change is triggered.

## Why?

Across different projects we found ourselves reinventing the same approach to layer management for each combination of map library and UI framework: adding and removing layers, cascading visibility and opacity through groups, and keeping the layer order in step with the map. We wanted to find a way to reuse the logic across projects.


## How it works

+ The **layer manager** (`LayerManager`) is the central store. It owns the layer tree and handles cascading rules—for example, automatically enabling parent groups when a hidden layer is switched on.
+ Your **UI** calls the manager to make updates (such as `setEnabled`, `setOpacity`, or `moveLayer`) and subscribes to state changes through callbacks.
+ An **adapter** applies manager state to the map. `@ulm/leaflet` provides one for Leaflet and `@ulm/maplibre` one for MapLibre, and you can [implement your own](./adapters/writing-an-adapter) for any other map library.

Each layer and group is modelled as an [XState](https://stately.ai/docs/xstate) state machine, so the rules governing their behaviour are explicit, predictable, and straightforward to test. You don't need to know XState to use the library, but the underlying actors are available if you [want to work with them directly](./xstate).

## A quick look

```ts
import { LayerManager } from '@ulm/core';
import { LeafletLayerManagerAdapter } from '@ulm/leaflet';
import * as L from 'leaflet';

// your own data for each layer: the Leaflet layer to draw, plus anything else
// you want to keep with it, such as a note to show in your layer list
interface LayerData {
  leafletLayer: L.Layer;
  note: string;
}

const map = L.map('map').setView([51.505, -0.09], 13);

// create the manager and connect it to the map through the Leaflet adapter
const manager = new LayerManager<LayerData>();
manager.setAdapter(new LeafletLayerManagerAdapter<LayerData>(map));

// add a group to hold the circles; a group has no map layer of its own
manager.addGroup({
  layerConfig: { layerId: 'circles', layerName: 'Circles', layerType: 'layerGroup' },
  visible: true,
});

// add two circles inside the group, using its layerId as their parentId
manager.addLayer({
  layerConfig: {
    layerId: 'red-circle',
    layerName: 'Red circle',
    layerType: 'layer',
    parentId: 'circles',
    layerData: {
      leafletLayer: L.circle([51.505, -0.1], { radius: 1000, color: 'red' }),
      note: 'Survey area A',
    },
  },
  visible: true,
});

manager.addLayer({
  layerConfig: {
    layerId: 'blue-circle',
    layerName: 'Blue circle',
    layerType: 'layer',
    parentId: 'circles',
    layerData: {
      leafletLayer: L.circle([51.505, -0.08], { radius: 1000, color: 'blue' }),
      note: 'Survey area B',
    },
  },
  visible: true,
});

// fade the group, and both circles fade with it
manager.setOpacity('circles', 0.5);

// switch the group off, and both circles leave the map
manager.setEnabled('circles', false);
```

Ready to try it? Head to [Getting started](./getting-started).

