import type BaseLayer from 'ol/layer/Base.js';
import { LayerManager } from '@ulm/core';
import VectorLayer from 'ol/layer/Vector.js';
import OlMap from 'ol/Map.js';
import VectorSource from 'ol/source/Vector.js';
import { describe, expect, it } from 'vitest';
import { OpenLayersLayerManagerAdapter } from '../src/openlayers-adapter';

interface LayerData {
  openlayersLayer: BaseLayer;
}

type Manager = LayerManager<LayerData>;

function setup() {
  const map = new OlMap();
  const manager: Manager = new LayerManager<LayerData>({ allowNestedGroupLayers: true });
  manager.setAdapter(new OpenLayersLayerManagerAdapter<LayerData>(map));
  return { map, manager };
}

function vectorLayer(): VectorLayer {
  return new VectorLayer({ source: new VectorSource() });
}

// Whether the map draws the layer: it is on the map, and switched on there.
function isShowing(map: OlMap, openlayersLayer: BaseLayer): boolean {
  const layersOnMap: BaseLayer[] = map.getAllLayers();
  return layersOnMap.includes(openlayersLayer) && openlayersLayer.getVisible();
}

function layerParams(layerId: string, openlayersLayer: BaseLayer, parentId: string | null = null) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layer' as const, parentId, layerData: { openlayersLayer } } };
}

function groupParams(layerId: string) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layerGroup' as const } };
}

describe('openLayersLayerManagerAdapter', () => {
  it('puts a visible layer on the map when it is added', () => {
    const { map, manager } = setup();
    const openlayersLayer = vectorLayer();

    manager.addLayer({ ...layerParams('layer-1', openlayersLayer), visible: true });

    expect(map.getAllLayers()).toContain(openlayersLayer);
  });

  it('hides a layer that is added switched off', () => {
    const { map, manager } = setup();
    const openlayersLayer = vectorLayer();

    manager.addLayer({ ...layerParams('layer-1', openlayersLayer), visible: false });

    expect(isShowing(map, openlayersLayer)).toBe(false);
  });

  it('shows a hidden layer when it is switched on', () => {
    const { map, manager } = setup();
    const openlayersLayer = vectorLayer();
    manager.addLayer({ ...layerParams('layer-1', openlayersLayer), visible: false });

    manager.setEnabled('layer-1', true);

    expect(isShowing(map, openlayersLayer)).toBe(true);
  });

  it('takes a layer off the map when it is removed', () => {
    const { map, manager } = setup();
    const openlayersLayer = vectorLayer();
    manager.addLayer({ ...layerParams('layer-1', openlayersLayer), visible: true });

    manager.removeLayer('layer-1');

    expect(map.getAllLayers()).not.toContain(openlayersLayer);
  });

  it('draws a layer at its opacity combined with its group\'s', () => {
    const { manager } = setup();
    const openlayersLayer = vectorLayer();
    manager.addGroup(groupParams('group-1'));
    manager.addLayer(layerParams('child-1', openlayersLayer, 'group-1'));

    manager.setOpacity('group-1', 0.5);
    manager.setOpacity('child-1', 0.8);

    expect(openlayersLayer.getOpacity()).toBeCloseTo(0.4);
  });

  it('draws a layer at its opacity combined with its group\'s as soon as it is added', () => {
    const { manager } = setup();
    const openlayersLayer = vectorLayer();
    manager.addGroup({ layerConfig: { ...groupParams('group-1').layerConfig, opacity: 0.5 } });

    manager.addLayer({ layerConfig: { ...layerParams('child-1', openlayersLayer, 'group-1').layerConfig, opacity: 0.8 } });

    expect(openlayersLayer.getOpacity()).toBeCloseTo(0.4);
  });
});
