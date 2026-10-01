# Visibility and opacity

This page covers switching layers on and off, how groups decide whether a layer is actually showing, and setting opacity.

The examples assume a manager with this layer structure, all added switched off. See [Layers and groups](./layers-and-groups) for how to add them. The trees on this page show the state of each layer after each example.

```
LayerManager
├── coastline        disabled
└── ocean (group)    disabled
    └── sea-ice      disabled
```

## Switching layers on and off

Switch a layer on with `setEnabled`:

```ts
manager.setEnabled('coastline', true);
```

The coastline sits at the top level with no groups above it, so switching it on makes it visible straight away:

```
LayerManager
├── coastline        enabled, visible
└── ocean (group)    disabled
    └── sea-ice      disabled
```

Switching it off again hides it, and the tree goes back to how it started:

```ts
manager.setEnabled('coastline', false);
```

## Enabled and visible

The manager keeps track of two separate things for every layer and group:

+ **Enabled** is whether the layer has been switched on. This is what you set with `setEnabled`.
+ **Visible** is whether the layer is actually showing. A layer is visible when it is enabled and every group above it is visible too.

For a top-level layer the two are always the same. Inside a group they can differ, because the group above the layer has a say in whether it shows.

### Cascading through groups

Switching on a layer inside a group also switches on every group above it, so the layer always becomes visible, however deeply it is nested:

```ts
manager.setEnabled('sea-ice', true);
```

```
LayerManager
├── coastline        disabled
└── ocean (group)    enabled, visible
    └── sea-ice      enabled, visible
```

Switching a group off hides everything inside it, but leaves those layers enabled:

```ts
manager.setEnabled('ocean', false);
```

```
LayerManager
├── coastline        disabled
└── ocean (group)    disabled
    └── sea-ice      enabled, hidden
```

When the group is switched back on, the sea ice shows again just as it was, and the tree is the same as after switching on the sea ice:

```ts
manager.setEnabled('ocean', true);
```

## Opacity

Every layer and group has its own opacity, from `0` (transparent) to `1` (opaque), set with `setOpacity`. A group's opacity also applies to the layers inside it, so the manager gives each layer a *computed opacity*, which is the value to use on the map.

```ts
manager.setOpacity('ocean', 0.5);
```

```
LayerManager
├── coastline        opacity 1
└── ocean (group)    opacity 0.5
    └── sea-ice      opacity 1, computed opacity 0.5
```

## Listening for changes

Your layer list and the rest of your UI need to react when these values change. Pass `onVisibilityChanged` and `onOpacityChanged` callbacks when creating the manager. Each receives the layer's details, including its `enabled`, `visible`, `opacity` and `computedOpacity`, along with your own `layerData`.

```ts
const manager = new LayerManager<LayerData>({
  onVisibilityChanged(info, visible) {
    console.log(`${info.layerName}: ${visible ? 'showing' : 'hidden'}, enabled: ${info.enabled}`);
  },
  onOpacityChanged(info, computedOpacity) {
    console.log(`${info.layerName}: opacity ${info.opacity}, computed opacity ${computedOpacity}`);
  },
});
```

Running the cascading examples above prints:

```
Ocean: showing, enabled: true
Sea ice: showing, enabled: true
Ocean: hidden, enabled: false
Sea ice: hidden, enabled: true
Sea ice: showing, enabled: true
Ocean: showing, enabled: true
```

The callbacks fire for groups as well as layers, and only for those whose values actually changed. Switching on the sea ice, for example, also reports the ocean group.

::: tip
In a layer list, tie each checkbox to `info.enabled` and use `info.visible` to show whether the layer is actually on the map, for example by greying out a row that is switched on but hidden.
:::
