# Writing an adapter

There are two main reasons to write your own adapter:

+ to support a map library we don't provide an adapter for, such as OpenLayers or MapLibre;
+ to add your own behaviour, such as synthetic layers that filter the features of a single map layer instead of adding and removing layers.

## The adapter interface

An adapter is any object that implements `LayerManagerAdapter` from `@ulm/core`. Every method is optional, so you only implement the ones you need:

| Method | Called when |
|---|---|
| `register(manager, callbacks)` | The adapter is attached. `callbacks.getSnapshot()` returns the top-level items and `callbacks.getLayer(id)` returns one item |
| `unregister()` | The adapter is detached, replaced, or the manager is destroyed |
| `onLayerAdded(info)` | A layer or group is added, or already exists when the adapter is attached |
| `onLayerRemoved(layerId)` | A layer or group is removed |
| `onVisibilityChanged(info, visible)` | A layer or group starts or stops showing |
| `onEnabledChanged(info, enabled)` | A layer or group is switched on or off, including while a group above hides it |
| `onOpacityChanged(info, computedOpacity)` | A layer's computed opacity changes |
| `onTimeInfoChanged(info, timeInfo)` | A layer's time information changes |
| `onLayerDataChanged(info)` | A layer's `layerData` is replaced |
| `onOrderChanged(layerOrder)` | The order changes, or the adapter is attached, with every layer ID from bottom to top |
| `onLayerMoved(info)` | A layer or group is moved, raised or lowered, with `info.parentId` set to its new parent |

To draw a map, `onVisibilityChanged` is enough: it says what should be showing. Use `onEnabledChanged` only if your adapter also needs to know about switches that don't change what is drawn, for example to keep a map library's own layer control in step.

## A minimal adapter

This adapter logs each call instead of changing a map. Copy it as a starting point, then replace each `console.log` with the matching call in your map library.

```ts
import type { LayerManagerAdapter } from '@ulm/core';

// the data each layer carries; here, where to load it from
interface LayerData {
  url: string;
}

export function createMyAdapter(): LayerManagerAdapter<LayerData, undefined> {
  // the layers this adapter has created on the map
  const mapLayers = new Set<string>();

  return {
    onLayerAdded(info) {
      // groups have nothing to draw, so only handle layers
      if (info.layerType !== 'layer') {
        return;
      }
      mapLayers.add(info.layerId);
      console.log(`create ${info.layerId} from ${info.layerData.url}`);
    },

    onLayerRemoved(layerId) {
      mapLayers.delete(layerId);
      console.log(`remove ${layerId}`);
    },

    onVisibilityChanged(info, visible) {
      if (!mapLayers.has(info.layerId)) {
        return;
      }
      console.log(`${visible ? 'show' : 'hide'} ${info.layerId}`);
    },

    onOpacityChanged(info, computedOpacity) {
      if (!mapLayers.has(info.layerId)) {
        return;
      }
      console.log(`set ${info.layerId} opacity to ${computedOpacity}`);
    },

    onOrderChanged(layerOrder) {
      // the order includes groups, so keep only the layers on the map
      const stack = layerOrder.filter((layerId) => mapLayers.has(layerId));
      console.log(`stack from the bottom: ${stack.join(', ')}`);
    },

    unregister() {
      for (const layerId of mapLayers) {
        console.log(`remove ${layerId}`);
      }
      mapLayers.clear();
    },
  };
}
```

A few things to note:

+ Groups have nothing to draw. Their visibility and opacity already flow into each layer inside them, so the adapter only needs to handle layers.
+ `computedOpacity` already includes the opacity of every group above the layer, so it is the value to apply on the map.
+ `unregister` is where the adapter removes everything it added to the map.

### Trying it out

Attach the adapter and make a few changes:

```ts
import { LayerManager } from '@ulm/core';

const manager = new LayerManager<LayerData>();
manager.setAdapter(createMyAdapter());

manager.addLayer({
  layerConfig: {
    layerId: 'osm',
    layerName: 'OpenStreetMap',
    layerType: 'layer',
    parentId: null,
    layerData: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
  },
  visible: true,
});

manager.setOpacity('osm', 0.5);
manager.setAdapter(null);
```

This prints:

```
create osm from https://tile.openstreetmap.org/{z}/{x}/{y}.png
stack from the bottom: osm
show osm
set osm opacity to 0.5
remove osm
```

## Custom behaviour

An adapter doesn't have to add and remove map layers. In this example, each layer in the manager stands for a road type, and switching layers on and off filters a single roads layer on the map:

```ts
interface RoadData {
  roadType: string;
}

// the road types that are switched on
const visibleRoadTypes = new Set<string>();

const roadsAdapter: LayerManagerAdapter<RoadData, undefined> = {
  onVisibilityChanged(info, visible) {
    if (info.layerType !== 'layer') {
      return;
    }
    if (visible) {
      visibleRoadTypes.add(info.layerData.roadType);
    } else {
      visibleRoadTypes.delete(info.layerData.roadType);
    }
    // filter the single roads layer on the map to the road types switched on
    console.log(`show road types: ${[...visibleRoadTypes].join(', ')}`);
  },
};
```

Adding a `motorways` and a `minor` layer, both visible, then switching off the motorways prints:

```
show road types: motorway
show road types: motorway, minor
show road types: minor
```

Your layer list stays exactly the same. It still shows two layers that can be switched on and off.

## Other map libraries

The same shape works for any map library. Each adapter method maps onto a handful of calls, such as adding a layer, toggling its visibility, setting its opacity or restacking it, so adapting the minimal adapter above is usually a matter of filling in those calls.

::: tip Help wanted
Written an adapter for another map library? We'd love to include it. See [Contributing](../contributing).
:::
