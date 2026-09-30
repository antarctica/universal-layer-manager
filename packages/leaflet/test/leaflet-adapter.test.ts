import type L from 'leaflet';
import { LayerManager } from '@ulm/core';
import { describe, expect, it } from 'vitest';
import { LeafletLayerManagerAdapter } from '../src/leaflet-adapter';

interface StubLayer {
  id: string;
  opacity: number;
  addTo: (map: FakeMap) => StubLayer;
  setOpacity: (opacity: number) => StubLayer;
}

interface StubLayerData {
  leafletLayer: StubLayer;
}

type FakeMap = ReturnType<typeof createFakeMap>;

function createFakeMap() {
  const layers = new Set<StubLayer>();
  return {
    hasLayer: (layer: StubLayer) => layers.has(layer),
    addLayer: (layer: StubLayer) => {
      layers.add(layer);
    },
    removeLayer: (layer: StubLayer) => {
      layers.delete(layer);
    },
  };
}

function createStubLayer(id: string): StubLayer {
  const stub: StubLayer = {
    id,
    opacity: 1,
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

  it('exposes the map it draws on', () => {
    const { map, adapter } = setup();

    expect(adapter.getContext()).toBe(map);
  });
});
