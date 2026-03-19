import type L from 'leaflet';
import { LayerManager } from '@ulm/core';
import { describe, expect, it } from 'vitest';
import { LeafletLayerManagerAdapter } from '../src/leaflet-adapter';

interface StubLayerData {
  leafletLayer: Record<string, unknown>;
}

function createFakeMap() {
  const layers = new Set<Record<string, unknown>>();
  const mapApi = {
    layers,
    hasLayer: (layer: Record<string, unknown>) => layers.has(layer),
    addLayer: (layer: Record<string, unknown>) => {
      layers.add(layer);
    },
    removeLayer: (layer: Record<string, unknown>) => {
      layers.delete(layer);
    },
  };
  return mapApi;
}

function createStubLayer() {
  const stub = {
    id: 'stub-layer',
    addTo: (m: ReturnType<typeof createFakeMap>) => {
      m.addLayer(stub);
      return stub;
    },
  };
  return stub;
}

describe('leafletLayerManagerAdapter', () => {
  it('adds a layer to the map when a layer is added via LayerManager', () => {
    const fakeMap = createFakeMap();
    const stubLayer = createStubLayer();
    const adapter = new LeafletLayerManagerAdapter<StubLayerData, undefined>(fakeMap as unknown as L.Map);
    const manager = new LayerManager<StubLayerData>({ allowNestedGroupLayers: true });
    manager.setAdapter(adapter);

    manager.addLayer({
      layerConfig: {
        layerId: 'layer-1',
        layerName: 'Test',
        layerType: 'layer',
        parentId: null,
        layerData: { leafletLayer: stubLayer },
      },
      visible: true,
    });

    expect(fakeMap.hasLayer(stubLayer)).toBe(true);
    manager.destroy();
  });

  it('removes a layer from the map when removed via LayerManager', () => {
    const fakeMap = createFakeMap();
    const stubLayer = createStubLayer();
    const adapter = new LeafletLayerManagerAdapter<StubLayerData, undefined>(fakeMap as unknown as L.Map);
    const manager = new LayerManager<StubLayerData>({ allowNestedGroupLayers: true });
    manager.setAdapter(adapter);

    manager.addLayer({
      layerConfig: {
        layerId: 'layer-1',
        layerName: 'Test',
        layerType: 'layer',
        parentId: null,
        layerData: { leafletLayer: stubLayer },
      },
      visible: true,
    });

    expect(fakeMap.hasLayer(stubLayer)).toBe(true);

    manager.removeLayer('layer-1');

    expect(fakeMap.hasLayer(stubLayer)).toBe(false);
    manager.destroy();
  });

  it('unregister removes all layers from the map', () => {
    const fakeMap = createFakeMap();
    const stubLayer = createStubLayer();
    const adapter = new LeafletLayerManagerAdapter<StubLayerData, undefined>(fakeMap as unknown as L.Map);
    const manager = new LayerManager<StubLayerData>({ allowNestedGroupLayers: true });
    manager.setAdapter(adapter);

    manager.addLayer({
      layerConfig: {
        layerId: 'layer-1',
        layerName: 'Test',
        layerType: 'layer',
        parentId: null,
        layerData: { leafletLayer: stubLayer },
      },
      visible: true,
    });

    expect(fakeMap.hasLayer(stubLayer)).toBe(true);

    manager.setAdapter(null);

    expect(fakeMap.hasLayer(stubLayer)).toBe(false);
    manager.destroy();
  });

  it('getContext returns the map', () => {
    const fakeMap = createFakeMap();
    const adapter = new LeafletLayerManagerAdapter<StubLayerData, undefined>(fakeMap as unknown as L.Map);

    expect(adapter.getContext()).toBe(fakeMap);
  });
});
