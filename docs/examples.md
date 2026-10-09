# Examples

The repository includes example applications that take different approaches to building a user interface on top of the layer manager, so they are useful starting points for your own. To run them locally, see [From a local clone](./installation#from-a-local-clone).

## Simple: vanilla TypeScript

[Live demo](https://antarctica.github.io/universal-layer-manager/examples/simple/) · [Source](https://github.com/antarctica/universal-layer-manager/tree/main/examples/simple)

A layer list built with plain DOM code, with no framework and no map. You can add layers and groups, switch them on and off, change their opacity, and raise, lower or remove them. An event log beside the list shows each change hook as it fires.

### The approach

The whole list is drawn from the manager's layer tree. The list subscribes to the manager, and `render` reads `getTree()`, throws the old list away and draws it again:

```ts
const manager = new LayerManager<undefined>({ allowNestedGroupLayers: true });
manager.subscribe(render);

function render() {
  const { rootIds, layers } = manager.getTree();
  list.replaceChildren(...renderLayers(rootIds, layers));
}
```

The list never keeps its own copy of the layer state. Its checkboxes and sliders call manager methods such as `setEnabled` and `setOpacity`, and the subscription then redraws the list with the result. Redrawing everything keeps the code simple and is fast enough for a short list. For long lists, subscribe to each layer instead, as the Leaflet example does.

### The event log

The change hooks in the manager's options report each change separately, the same hooks an adapter receives. The example writes each one to a log:

```ts
const manager = new LayerManager<undefined>({
  allowNestedGroupLayers: true,
  onLayerAdded: (info) => logEvent('onLayerAdded', info.layerName),
  onVisibilityChanged: (info, visible) => logEvent('onVisibilityChanged', `${info.layerName} → ${visible ? 'visible' : 'hidden'}`),
  onOrderChanged: (layerOrder) => logEvent('onOrderChanged', `bottom → top: ${layerOrder.join(', ') || 'empty'}`),
  onError: (error) => logEvent('onError', error.message),
  // …and the other hooks
});
```

The log shows that one action can report many changes. Switch off a group and the group and every layer inside it report `onVisibilityChanged`, then the group alone reports `onEnabledChanged`, as its children stay switched on. Change a group's opacity and the group and each layer inside it report their new computed opacity. Try to remove a group that still has children and the manager rejects it through `onError`.

## Leaflet and React

[Live demo](https://antarctica.github.io/universal-layer-manager/examples/leaflet/) · [Source](https://github.com/antarctica/universal-layer-manager/tree/main/examples/leaflet)

A React layer list alongside a Leaflet map, with nested groups, tile layers, circles and a marker. Layers can be switched on and off, faded, and reordered by drag and drop, and the map follows every change.

### The approach

A single `LayerManager` is created once and shared through React context. The layer list and the map are separate components that never talk to each other directly. Both work through the manager:

+ The **map** attaches the Leaflet adapter and adds the initial layers. From then on, the adapter keeps the map in step.
+ The **layer list** reads the manager's layer tree with React's `useSyncExternalStore`, and changes layers through manager methods such as `setEnabled` and `setOpacity`.

Two small hooks do the reading:

```tsx
function useLayerTree() {
  const manager = useLayerManager();
  return React.useSyncExternalStore(manager.subscribe, manager.getTree);
}

function useLayer(layerId: string) {
  const manager = useLayerManager();
  return React.useSyncExternalStore(manager.subscribe, () => manager.getTree().layers[layerId]);
}
```

The list renders `rootIds`, and each group renders its `childIds`. Each row is memoised on its `layerId` and reads its own layer with `useLayer`. A layer that didn't change keeps the same info object, so a row re-renders only when its own layer changes.

### Worth a closer look

+ **One row component.** Layers and groups share a single, memoised `LayerRow`, because both are plain info with the same fields.
+ **Drag and drop.** `layerList/useLayerDragAndDrop.ts` finds where a layer sits from its `parentId` and its parent's `childIds`, and turns a drop in a top-first list into a `moveLayer` call, which counts from the bottom and from after the layer has left its old place.
+ **Invalid moves.** The list doesn't try to prevent drops such as a group into itself. It leaves the manager to reject them, and logs the reason from `onError`.
+ **The manager is a store.** `layers/manager.ts` creates it once, outside React, and adds the starting layers, and the provider only makes it available. The map's effect attaches the adapter and detaches it in its cleanup. The manager replays its layers to each newly attached adapter, so React's development double-run needs no reset, and layers added by the user survive the map remounting.

### When your starting layers depend on parameters

The example's starting layers are fixed, so it builds them with the manager. When they depend on something only known inside React, such as a prop, the route or data you fetch, keep the manager as a store and add the layers in an effect keyed on those values. The layers then belong to those values, so the effect removes them in its cleanup:

```tsx
function useLayersFor(crs, products) {
  const manager = useLayerManager();
  React.useEffect(() => {
    if (!products) {
      return;
    }
    addLayersFor(manager, { crs, products });
    return () => manager.reset();
  }, [manager, crs, products]);
}
```

A change of `crs` or `products` then replaces the layers, and the map's adapter receives the removals and additions like any other change. Use simple values as dependencies, so the effect runs again only when they really change.

Parameters known before React starts, such as the page's URL parameters, don't need this: pass them to the setup in `layers/manager.ts`. And to change layers that already exist, for example switching one on from the URL, call methods such as `setEnabled` instead of rebuilding.

## MapLibre and React

[Live demo](https://antarctica.github.io/universal-layer-manager/examples/maplibre/) · [Source](https://github.com/antarctica/universal-layer-manager/tree/main/examples/maplibre)

A React layer list alongside a MapLibre GL JS map, with raster and vector tile layers, nested groups, and a basemap switcher. The layer list is the same shape as the Leaflet example: it reads the manager's layer tree with `useSyncExternalStore` and changes layers through manager methods.

### The approach

The manager and list work as in the Leaflet example. The differences are on the map side:

+ Each layer's `layerData` is a MapLibre style (sources and style layers). The adapter draws that by default, so it needs no `renderLayer` option.
+ Managed layers sit below the basemap's labels, in the manager's order. Vector layers can share one OpenFreeMap source so its tiles load once.
+ The basemap is the map's style, not a manager layer. A fixed row at the bottom of the list calls `map.setStyle`, and the adapter puts the managed layers back below the new labels.

```ts
manager.setAdapter(new MapLibreLayerManagerAdapter<LayerData>(map));
```

See the [MapLibre guide](./adapters/maplibre) for shared sources, stacking and opacity.

## ArcGIS and React

[Live demo](https://antarctica.github.io/universal-layer-manager/examples/arcgis/) · [Source](https://github.com/antarctica/universal-layer-manager/tree/main/examples/arcgis)

A React layer list alongside the `<arcgis-map>` component, set in Antarctica on the British Antarctic Survey basemap. It shows daily AMSR2 sea ice concentration with a date to pick, Antarctic Digital Database layers, and Bedmap3 ice sheet layers. The layer list is the same shape as the MapLibre example.

### The approach

The manager and list work as in the other examples. The differences are on the map side:

+ Each layer's `layerData.arcgisLayer` is the ArcGIS layer that shows it, which the adapter shows by default.
+ The adapter adds the managed layers straight to the map, in the manager's order.
+ The sea ice layer is time-aware. A `renderLayer` sets its `timeExtent` from the layer's `timeInfo`, and ArcGIS asks the WMS server for that day.
+ The adapter is attached in a layout effect, so it takes its layers off the map before `<arcgis-map>` destroys the map.

```ts
manager.setAdapter(new ArcGISLayerManagerAdapter<LayerData>(map, { renderLayer }));
```

See the [ArcGIS guide](./adapters/arcgis) for stacking, the `container` option and opacity.

## OpenLayers and React

[Live demo](https://antarctica.github.io/universal-layer-manager/examples/openlayers/) · [Source](https://github.com/antarctica/universal-layer-manager/tree/main/examples/openlayers)

A React layer list alongside an OpenLayers map, with raster and vector tile layers, nested groups, and a basemap switcher. The layer list is the same shape as the MapLibre example.

### The approach

The manager and list work as in the other examples. The differences are on the map side:

+ Each layer's `layerData.openlayersLayer` is the OpenLayers layer that shows it, which the adapter shows by default.
+ The basemap is two layers of the app's own, the map and its labels. The app puts a layer group between them and passes it as the `container` option, so the managed layers sit below the labels, in the manager's order.
+ The vector layers share one OpenFreeMap vector tile source, and each draws the features of one source layer.
+ Switching the basemap gives the app's two layers new sources. The managed layers are untouched.

```ts
manager.setAdapter(new OpenLayersLayerManagerAdapter<LayerData>(map, { container: managedLayers }));
```

See the [OpenLayers guide](./adapters/openlayers) for the layer group, the `container` option and opacity.

## Leaflet and React with XState (advanced)

[Live demo](https://antarctica.github.io/universal-layer-manager/examples/leaflet-xstate/) · [Source](https://github.com/antarctica/universal-layer-manager/tree/main/examples/leaflet-xstate)

The same layer list and map, built on the manager machine and its actors with `@xstate/react`, without the `LayerManager` class. Choose this approach if you already use XState and want to work with the actors directly. Otherwise, start with the example above.

### The approach

`createActorContext` from `@xstate/react` provides the manager machine, run without the `LayerManager` class as in [Working with XState](./xstate#without-the-layermanager-class). Components get the actor with `LayerManagerContext.useActorRef()` and pass it on as an input:

```tsx
function ManagerSetup({ map }) {
  const managerRef = LayerManagerContext.useActorRef();

  // the starting layers, removed again in the effect's cleanup
  React.useEffect(() => addStartingLayers(managerRef), [managerRef]);

  // the map
  React.useEffect(() => connectAdapter(managerRef, new LeafletLayerManagerAdapter<LayerData>(map)), [managerRef, map]);

  return null;
}
```

Each row gets its layer's actor as a prop, subscribes to it with `useSelector`, and sends it events such as `LAYER.SET_OPACITY`. The add buttons and drag and drop send `LAYER.ADD` and `LAYER.MOVE` to the manager actor.

### Worth a closer look

+ **Starting layers in an effect.** The provider creates the actor inside React, so the starting layers are added in an effect, and its cleanup sends `RESET`. This is the parameterised pattern from the example above.
+ **Children from the manager's list.** A group's child actors are looked up by ID in the manager's typed list of layers, in the group's own `childLayerOrder`.
+ **Rejections.** Without the class's `onError` option, the demo listens for `LAYER.REJECTED` on the manager actor.
