# About adapters

How does the layer manager talk to a map? Through an adapter.

The manager owns the layer state, and the adapter owns the map. Whenever the layer state changes, the manager tells the adapter, and the adapter updates the map to match.

## How adapters work

An adapter has a method for each kind of change, such as a layer being added, hidden or moved. The manager calls these methods as changes happen, and the adapter turns each one into calls to its map library.

Changes cascade through to the map. Switching off a group is a single call to the manager, which then tells the adapter about every layer that is now hidden. The adapter never makes decisions about layer state itself, so the map always matches the manager.

See the [`@ulm/core` reference](../reference/core#adapter-interface) for every adapter method.

## With or without an adapter

You don't have to use an adapter. You can listen to the manager's callbacks and update the map yourself.

For most applications an adapter is the better pattern. It keeps your map code in one place, separate from your UI, and moving to a different map library just means swapping the adapter.

## Attaching and detaching

```ts
import { LeafletLayerManagerAdapter } from '@ulm/leaflet';

manager.setAdapter(new LeafletLayerManagerAdapter(map)); // attach
manager.setAdapter(null); // detach
```

Attaching an adapter replaces any existing one, and tells it about any layers already added. When an adapter is detached, replaced, or the manager is destroyed, the adapter cleans up after itself. The Leaflet adapter, for example, removes its layers from the map.

## Available adapters

We currently provide adapters for [Leaflet](./leaflet), in `@ulm/leaflet`, [MapLibre GL JS](./maplibre), in `@ulm/maplibre`, and the [ArcGIS Maps SDK for JavaScript](./arcgis), in `@ulm/arcgis`. For other map libraries, you can [write your own](./writing-an-adapter).
