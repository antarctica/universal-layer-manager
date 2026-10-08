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

function setup(map = new OlMap()) {
  const manager: Manager = new LayerManager<LayerData>({ allowNestedGroupLayers: true });
  manager.setAdapter(new OpenLayersLayerManagerAdapter<LayerData>(map));
  return { map, manager };
}

function vectorLayer(id = 'layer'): VectorLayer {
  return new VectorLayer({ source: new VectorSource(), properties: { id } });
}

// Whether the map draws the layer: it is on the map, and switched on there.
function isShowing(map: OlMap, openlayersLayer: BaseLayer): boolean {
  const layersOnMap: BaseLayer[] = map.getAllLayers();
  return layersOnMap.includes(openlayersLayer) && openlayersLayer.getVisible();
}

function layerId(openlayersLayer: BaseLayer): string {
  const id: unknown = openlayersLayer.get('id');
  return typeof id === 'string' ? id : '';
}

// The IDs of the given layers in the order the map draws them, from the bottom up.
function drawOrder(map: OlMap, openlayersLayers: BaseLayer[]): string[] {
  return map.getAllLayers().filter((layer) => openlayersLayers.includes(layer)).map(layerId);
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

  it('draws the new OpenLayers layer in the old one\'s place when a layer\'s data changes', () => {
    const { map, manager } = setup();
    const [bottom, before, top] = ['bottom', 'before', 'top'].map((id) => vectorLayer(id));
    manager.addLayer({ ...layerParams('bottom', bottom), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('layer-1', before), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('top', top), visible: true, position: 'top' });
    const after = vectorLayer('after');

    manager.updateLayerData('layer-1', { openlayersLayer: after });

    expect(drawOrder(map, [bottom, before, after, top])).toEqual(['bottom', 'after', 'top']);
  });

  it('draws layers in the manager\'s order, from the bottom up', () => {
    const { map, manager } = setup();
    const openlayersLayers = ['first', 'second', 'third'].map((id) => vectorLayer(id));
    for (const openlayersLayer of openlayersLayers) {
      manager.addLayer({ ...layerParams(layerId(openlayersLayer), openlayersLayer), visible: true, position: 'top' });
    }

    manager.moveLayer('first', { parentId: null, position: 'top' });

    expect(drawOrder(map, openlayersLayers)).toEqual(['second', 'third', 'first']);
  });

  it('draws its layers above the layers already on the map when it is attached', () => {
    const appLayer = vectorLayer('app');
    const { map, manager } = setup(new OlMap({ layers: [appLayer] }));
    const openlayersLayers = ['first', 'second'].map((id) => vectorLayer(id));

    for (const openlayersLayer of openlayersLayers) {
      manager.addLayer({ ...layerParams(layerId(openlayersLayer), openlayersLayer), visible: true, position: 'top' });
    }

    expect(drawOrder(map, [appLayer, ...openlayersLayers])).toEqual(['app', 'first', 'second']);
  });

  it('leaves only the app\'s own layers on the map when it is detached', () => {
    const appLayer = vectorLayer('app');
    const { map, manager } = setup(new OlMap({ layers: [appLayer] }));
    manager.addLayer({ ...layerParams('layer-1', vectorLayer()), visible: true });

    manager.setAdapter(null);

    expect(map.getLayers().getArray()).toEqual([appLayer]);
  });
});
