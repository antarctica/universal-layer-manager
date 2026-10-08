# Writing an adapter

There are two main reasons to write your own adapter:

+ to support a map library we don't provide an adapter for;
+ to add your own behaviour, such as synthetic layers that filter the features of a single map layer instead of adding and removing layers.

## The adapter interface

An adapter is any object that implements `LayerManagerAdapter` from `@ulm/core`. Every method is optional, so you only implement the ones you need:

| Method | Called when |
|---|---|
| `register()` | The adapter is attached, before it is told about existing layers |
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

### Guarantees

The manager calls an adapter in a predictable order, so your adapter doesn't need to guard against these cases:

+ **Added first, nothing after removal.** `onLayerAdded` is the first call for any layer or group. A newly added layer always arrives hidden, and a layer added as visible is shown by `onVisibilityChanged` straight after. An adapter attached to a manager that already has layers receives `onLayerAdded` for each of them in its current state, which may be visible, then `onOrderChanged`. After `onLayerRemoved` for an ID, or after `unregister`, nothing more arrives for it.
+ **The order follows every structural change.** After every add, remove, move and reset, `onOrderChanged` receives every current layer ID, bottom to top. For a move, `onLayerMoved` comes after `onOrderChanged`.
+ **Only real changes are reported.** A change that leaves a value as it was, such as setting the current opacity or moving a layer to where it already is, sends nothing. The one exception is `updateLayerData`, which always reports, because the manager can't compare your data.
+ **Adapter first.** Each hook runs on the adapter before the matching options callback, so by the time your UI hears about a change, the map already shows it.

## A minimal adapter

This adapter logs each call instead of changing a map. Copy it as a starting point, then replace each `console.log` with the matching call in your map library.

```ts
import type { LayerManagerAdapter } from '@ulm/core';

// the data each layer carries; here, where to load it from
interface LayerData {
  url: string;
}

export function createMyAdapter(): LayerManagerAdapter<LayerData> {
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

## Showing layers with `renderLayer`

The Leaflet and MapLibre adapters turn each layer into something the map shows with a `renderLayer` function, which the app can replace. If your adapter works the same way, extend `RenderAdapter` from `@ulm/core`. It handles every hook for you:

+ It calls `renderLayer` when a layer is added, and again with the last result as `current` when the layer's data or time changes. When `renderLayer` returns `current`, the map is left alone.
+ It calls `disposeLayer` when a result is removed, replaced or detached.
+ It skips groups, and keeps each layer's visibility, computed opacity and place in the order, even while `renderLayer` leaves the layer off the map.

Your adapter only changes the map:

```ts
import type { RenderAdapterOptions, RenderedLayer } from '@ulm/core';
import type { MapView } from 'my-map-library';
import { RenderAdapter } from '@ulm/core';
import { TileLayer } from 'my-map-library';

// the data each layer carries; here, where to load it from
interface LayerData {
  url: string;
}

export class MyAdapter extends RenderAdapter<LayerData, undefined, MapView, TileLayer> {
  constructor(map: MapView, options: RenderAdapterOptions<LayerData, MapView, TileLayer> = {}) {
    super(map, {
      renderLayer: options.renderLayer ?? ((info) => new TileLayer(info.layerData.url)),
      disposeLayer: options.disposeLayer,
    });
  }

  protected placeLayer({ rendered, visible, computedOpacity }: RenderedLayer<TileLayer>) {
    rendered.visible = visible;
    rendered.opacity = computedOpacity;
    this.map.add(rendered);
  }

  protected eraseLayer(_layerId: string, rendered: TileLayer) {
    this.map.remove(rendered);
  }

  protected setLayerVisible({ rendered, visible }: RenderedLayer<TileLayer>) {
    rendered.visible = visible;
  }

  protected setLayerOpacity({ rendered, computedOpacity }: RenderedLayer<TileLayer>) {
    rendered.opacity = computedOpacity;
  }

  protected restackLayers(bottomToTop: RenderedLayer<TileLayer>[]) {
    bottomToTop.forEach(({ rendered }, index) => {
      rendered.zIndex = index;
    });
  }
}
```

When a new result can update the map in place, `placeLayer` receives the result it replaces and `eraseLayer` the result that replaces it. Override `isSame` to say a new result stands in for the old one: the old one is then not disposed of, and the layer is not restacked. The MapLibre adapter does this for styles that differ only in GeoJSON data or tile URLs. If your map can lose everything you added, as MapLibre does when the app changes the style, call `placeAll()` to put it all back. See the [`@ulm/core` reference](../reference/core#for-adapters-that-render-layers) for details.

## Custom behaviour

An adapter doesn't have to add and remove map layers. In this example, each layer in the manager stands for a road type, and switching layers on and off filters a single roads layer on the map:

```ts
interface RoadData {
  roadType: string;
}

// the road types that are switched on
const visibleRoadTypes = new Set<string>();

const roadsAdapter: LayerManagerAdapter<RoadData> = {
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
