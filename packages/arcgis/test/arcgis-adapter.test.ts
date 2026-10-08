import type Layer from '@arcgis/core/layers/Layer.js';
import type { ArcGISAdapterOptions } from '../src/types';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import GroupLayer from '@arcgis/core/layers/GroupLayer.js';
import EsriMap from '@arcgis/core/Map.js';
import { LayerManager } from '@ulm/core';
import { describe, expect, it } from 'vitest';
import { ArcGISLayerManagerAdapter } from '../src/arcgis-adapter';

interface LayerData {
  arcgisLayer: Layer;
}

type Manager = LayerManager<LayerData>;

function setup(map = new EsriMap(), options: ArcGISAdapterOptions<LayerData> = {}) {
  const manager: Manager = new LayerManager<LayerData>({ allowNestedGroupLayers: true });
  manager.setAdapter(new ArcGISLayerManagerAdapter<LayerData>(map, options));
  return { map, manager };
}

// Whether the map draws the layer: it is on the map, and switched on there.
function isShowing(map: EsriMap, arcgisLayer: Layer): boolean {
  return map.allLayers.includes(arcgisLayer) && arcgisLayer.visible;
}

// The IDs of the given layers in the order the map draws them, from the bottom up.
function drawOrder(map: EsriMap, arcgisLayers: Layer[]): string[] {
  return map.allLayers.filter((layer) => arcgisLayers.includes(layer)).map(({ id }) => id).toArray();
}

function layerParams(layerId: string, arcgisLayer: Layer, parentId: string | null = null) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layer' as const, parentId, layerData: { arcgisLayer } } };
}

function groupParams(layerId: string) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layerGroup' as const } };
}

describe('arcGISLayerManagerAdapter', () => {
  it('puts a visible layer on the map when it is added', () => {
    const { map, manager } = setup();
    const arcgisLayer = new GraphicsLayer();

    manager.addLayer({ ...layerParams('layer-1', arcgisLayer), visible: true });

    expect(map.allLayers.includes(arcgisLayer)).toBe(true);
  });

  it('hides a layer that is added switched off', () => {
    const { map, manager } = setup();
    const arcgisLayer = new GraphicsLayer();

    manager.addLayer({ ...layerParams('layer-1', arcgisLayer), visible: false });

    expect(isShowing(map, arcgisLayer)).toBe(false);
  });

  it('shows a hidden layer when it is switched on', () => {
    const { map, manager } = setup();
    const arcgisLayer = new GraphicsLayer();
    manager.addLayer({ ...layerParams('layer-1', arcgisLayer), visible: false });

    manager.setEnabled('layer-1', true);

    expect(isShowing(map, arcgisLayer)).toBe(true);
  });

  it('takes a layer off the map when it is removed', () => {
    const { map, manager } = setup();
    const arcgisLayer = new GraphicsLayer();
    manager.addLayer({ ...layerParams('layer-1', arcgisLayer), visible: true });

    manager.removeLayer('layer-1');

    expect(map.allLayers.includes(arcgisLayer)).toBe(false);
  });

  it('draws a layer at its opacity combined with its group\'s', () => {
    const { manager } = setup();
    const arcgisLayer = new GraphicsLayer();
    manager.addGroup(groupParams('group-1'));
    manager.addLayer(layerParams('child-1', arcgisLayer, 'group-1'));

    manager.setOpacity('group-1', 0.5);
    manager.setOpacity('child-1', 0.8);

    expect(arcgisLayer.opacity).toBeCloseTo(0.4);
  });

  it('draws a layer at its opacity combined with its group\'s as soon as it is added', () => {
    const { manager } = setup();
    const arcgisLayer = new GraphicsLayer();
    manager.addGroup({ layerConfig: { ...groupParams('group-1').layerConfig, opacity: 0.5 } });

    manager.addLayer({ layerConfig: { ...layerParams('child-1', arcgisLayer, 'group-1').layerConfig, opacity: 0.8 } });

    expect(arcgisLayer.opacity).toBeCloseTo(0.4);
  });

  it('draws the new ArcGIS layer in the old one\'s place when a layer\'s data changes', () => {
    const { map, manager } = setup();
    const [bottom, before, top] = ['bottom', 'before', 'top'].map((id) => new GraphicsLayer({ id }));
    manager.addLayer({ ...layerParams('bottom', bottom), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('layer-1', before), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('top', top), visible: true, position: 'top' });
    const after = new GraphicsLayer({ id: 'after' });

    manager.updateLayerData('layer-1', { arcgisLayer: after });

    expect(drawOrder(map, [bottom, before, after, top])).toEqual(['bottom', 'after', 'top']);
  });

  it('draws layers in the manager\'s order, from the bottom up', () => {
    const { map, manager } = setup();
    const arcgisLayers = ['first', 'second', 'third'].map((id) => new GraphicsLayer({ id }));
    for (const arcgisLayer of arcgisLayers) {
      manager.addLayer({ ...layerParams(arcgisLayer.id, arcgisLayer), visible: true, position: 'top' });
    }

    manager.moveLayer('first', { parentId: null, position: 'top' });

    expect(drawOrder(map, arcgisLayers)).toEqual(['second', 'third', 'first']);
  });

  it('draws its layers above the layers already on the map when it is attached', () => {
    const appLayer = new GraphicsLayer({ id: 'app' });
    const { map, manager } = setup(new EsriMap({ layers: [appLayer] }));
    const arcgisLayers = ['first', 'second'].map((id) => new GraphicsLayer({ id }));

    for (const arcgisLayer of arcgisLayers) {
      manager.addLayer({ ...layerParams(arcgisLayer.id, arcgisLayer), visible: true, position: 'top' });
    }

    expect(drawOrder(map, [appLayer, ...arcgisLayers])).toEqual(['app', 'first', 'second']);
  });

  it('leaves only the app\'s own layers on the map when it is detached', () => {
    const appLayer = new GraphicsLayer({ id: 'app' });
    const { map, manager } = setup(new EsriMap({ layers: [appLayer] }));
    manager.addLayer({ ...layerParams('layer-1', new GraphicsLayer()), visible: true });

    manager.setAdapter(null);

    expect(map.allLayers.toArray()).toEqual([appLayer]);
  });

  it('draws its layers in the group it is given, where the app put that group', () => {
    const [below, above] = ['below', 'above'].map((id) => new GraphicsLayer({ id }));
    const container = new GroupLayer();
    const { map, manager } = setup(new EsriMap({ layers: [below, container, above] }), { container });
    const arcgisLayers = ['first', 'second'].map((id) => new GraphicsLayer({ id }));

    for (const arcgisLayer of arcgisLayers) {
      manager.addLayer({ ...layerParams(arcgisLayer.id, arcgisLayer), visible: true, position: 'top' });
    }

    expect(drawOrder(map, [below, above, ...arcgisLayers])).toEqual(['below', 'first', 'second', 'above']);
  });

  it('leaves the group it is given on the map, emptied, when it is detached', () => {
    const container = new GroupLayer();
    const { map, manager } = setup(new EsriMap({ layers: [container] }), { container });
    manager.addLayer({ ...layerParams('layer-1', new GraphicsLayer()), visible: true });

    manager.setAdapter(null);

    expect(map.allLayers.toArray()).toEqual([container]);
  });
});
