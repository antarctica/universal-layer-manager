import type L from 'leaflet';
import { LayerManager } from '@ulm/core';
import { describe, expect, it } from 'vitest';
import { LeafletLayerManagerAdapter } from '../src/leaflet-adapter';

interface StubLayerOptions {
  pane?: string;
  shadowPane?: string;
}

interface StubLayer {
  id: string;
  opacity: number;
  options: StubLayerOptions;
  addTo: (map: FakeMap) => StubLayer;
  setOpacity: (opacity: number) => StubLayer;
  eachLayer?: (fn: (layer: StubLayer) => void) => StubLayer;
}

interface StubLayerData {
  leafletLayer: StubLayer;
}

interface FakePane {
  parent: FakePane | null;
  style: { zIndex: string };
}

type FakeMap = ReturnType<typeof createFakeMap>;

function createFakeMap() {
  const drawn: StubLayer[] = [];
  const panes = new Map<string, FakePane>();
  const zIndexOf = (layer: StubLayer) => Number(panes.get(layer.options.pane ?? '')?.style.zIndex ?? 0);
  return {
    hasLayer: (layer: StubLayer) => drawn.includes(layer),
    addLayer: (layer: StubLayer) => {
      if (!drawn.includes(layer)) {
        drawn.push(layer);
      }
    },
    removeLayer: (layer: StubLayer) => {
      if (drawn.includes(layer)) {
        drawn.splice(drawn.indexOf(layer), 1);
      }
    },
    createPane: (name: string, container?: FakePane) => {
      const pane: FakePane = { parent: container ?? null, style: { zIndex: '' } };
      panes.set(name, pane);
      return pane;
    },
    getPane: (name: string) => panes.get(name),
    // The layers on the map from the bottom up, as the browser stacks them: by pane z-index, then by when they were added.
    drawOrder: () => [...drawn].sort((a, b) => zIndexOf(a) - zIndexOf(b)).map((layer) => layer.id),
  };
}

function createStubLayer(id: string, options: StubLayerOptions = {}): StubLayer {
  const stub: StubLayer = {
    id,
    opacity: 1,
    options,
    addTo: (map) => {
      map.addLayer(stub);
      return stub;
    },
    setOpacity: (opacity) => {
      stub.opacity = opacity;
      return stub;
    },
  };
  return stub;
}

function createStubLayerGroup(id: string, children: StubLayer[]): StubLayer {
  const group = createStubLayer(id);
  group.eachLayer = (fn) => {
    children.forEach(fn);
    return group;
  };
  return group;
}

function setup() {
  const map = createFakeMap();
  const adapter = new LeafletLayerManagerAdapter<StubLayerData, undefined>(map as unknown as L.Map);
  const manager = new LayerManager<StubLayerData>({ allowNestedGroupLayers: true });
  manager.setAdapter(adapter);
  return { map, adapter, manager };
}

function layerParams(layerId: string, leafletLayer: StubLayer, parentId: string | null = null) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layer' as const, parentId, layerData: { leafletLayer } } };
}

function groupParams(layerId: string) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layerGroup' as const, parentId: null, layerData: undefined } };
}

describe('leafletLayerManagerAdapter', () => {
  it('puts a visible layer on the map when it is added', () => {
    const { map, manager } = setup();
    const leafletLayer = createStubLayer('layer-1');

    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });

    expect(map.hasLayer(leafletLayer)).toBe(true);
  });

  it('keeps a hidden layer off the map until it is shown', () => {
    const { map, manager } = setup();
    const leafletLayer = createStubLayer('layer-1');
    manager.addLayer(layerParams('layer-1', leafletLayer));
    expect(map.hasLayer(leafletLayer)).toBe(false);

    manager.setEnabled('layer-1', true);

    expect(map.hasLayer(leafletLayer)).toBe(true);
  });

  it('takes a layer off the map when it is hidden', () => {
    const { map, manager } = setup();
    const leafletLayer = createStubLayer('layer-1');
    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });

    manager.setEnabled('layer-1', false);

    expect(map.hasLayer(leafletLayer)).toBe(false);
  });

  it('takes a group\'s layers off the map while the group is hidden', () => {
    const { map, manager } = setup();
    const leafletLayer = createStubLayer('child-1');
    manager.addGroup({ ...groupParams('group-1'), visible: true });
    manager.addLayer({ ...layerParams('child-1', leafletLayer, 'group-1'), visible: true });

    manager.setEnabled('group-1', false);
    expect(map.hasLayer(leafletLayer)).toBe(false);

    manager.setEnabled('group-1', true);
    expect(map.hasLayer(leafletLayer)).toBe(true);
  });

  it('sets a layer\'s opacity to its opacity combined with its group\'s', () => {
    const { manager } = setup();
    const leafletLayer = createStubLayer('child-1');
    manager.addGroup(groupParams('group-1'));
    manager.addLayer(layerParams('child-1', leafletLayer, 'group-1'));

    manager.setOpacity('group-1', 0.5);
    manager.setOpacity('child-1', 0.8);

    expect(leafletLayer.opacity).toBe(0.4);
  });

  it('takes a layer off the map when it is removed', () => {
    const { map, manager } = setup();
    const leafletLayer = createStubLayer('layer-1');
    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });

    manager.removeLayer('layer-1');

    expect(map.hasLayer(leafletLayer)).toBe(false);
  });

  it('takes every layer off the map when the manager is reset', () => {
    const { map, manager } = setup();
    const first = createStubLayer('layer-1');
    const second = createStubLayer('layer-2');
    manager.addLayer({ ...layerParams('layer-1', first), visible: true });
    manager.addLayer({ ...layerParams('layer-2', second), visible: true });

    manager.reset();

    expect(map.hasLayer(first)).toBe(false);
    expect(map.hasLayer(second)).toBe(false);
  });

  it('takes every layer off the map when the adapter is detached', () => {
    const { map, manager } = setup();
    const leafletLayer = createStubLayer('layer-1');
    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });

    manager.setAdapter(null);

    expect(map.hasLayer(leafletLayer)).toBe(false);
  });

  it('draws layers in the manager\'s order, from the bottom up', () => {
    const { map, manager } = setup();
    manager.addLayer({ ...layerParams('first', createStubLayer('first')), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('second', createStubLayer('second')), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('third', createStubLayer('third')), visible: true, position: 'top' });

    manager.moveLayer('first', { parentId: null, position: 'top' });

    expect(map.drawOrder()).toEqual(['second', 'third', 'first']);
  });

  it('puts a layer back in its place in the order when it is shown again', () => {
    const { map, manager } = setup();
    manager.addLayer({ ...layerParams('bottom', createStubLayer('bottom')), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('top', createStubLayer('top')), visible: true, position: 'top' });

    manager.setEnabled('bottom', false);
    manager.setEnabled('bottom', true);

    expect(map.drawOrder()).toEqual(['bottom', 'top']);
  });

  it('draws a marker\'s shadow in the marker\'s place in the order', () => {
    const { manager } = setup();
    const marker = createStubLayer('marker', { shadowPane: 'shadowPane' });

    manager.addLayer({ ...layerParams('marker', marker), visible: true });

    expect(marker.options.shadowPane).toBe(marker.options.pane);
  });

  it('draws every layer in a Leaflet layer group, such as GeoJSON, in the group\'s place in the order', () => {
    const { manager } = setup();
    const polygon = createStubLayer('polygon');
    const point = createStubLayer('point', { shadowPane: 'shadowPane' });
    const geoJson = createStubLayerGroup('geojson', [polygon, point]);

    manager.addLayer({ ...layerParams('geojson', geoJson), visible: true });

    expect([polygon.options.pane, point.options.pane, point.options.shadowPane]).toEqual([geoJson.options.pane, geoJson.options.pane, geoJson.options.pane]);
  });

  it('exposes the map it draws on', () => {
    const { map, adapter } = setup();

    expect(adapter.getContext()).toBe(map);
  });
});
