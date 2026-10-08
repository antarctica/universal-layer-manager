import type Layer from '@arcgis/core/layers/Layer.js';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import EsriMap from '@arcgis/core/Map.js';
import { LayerManager } from '@ulm/core';
import { describe, expect, it } from 'vitest';
import { ArcGISLayerManagerAdapter } from '../src/arcgis-adapter';

interface LayerData {
  arcgisLayer: Layer;
}

type Manager = LayerManager<LayerData>;

function setup() {
  const map = new EsriMap();
  const manager: Manager = new LayerManager<LayerData>({ allowNestedGroupLayers: true });
  manager.setAdapter(new ArcGISLayerManagerAdapter<LayerData>(map));
  return { map, manager };
}

// Whether the map draws the layer: it is on the map, and switched on there.
function isShowing(map: EsriMap, arcgisLayer: Layer): boolean {
  return map.allLayers.includes(arcgisLayer) && arcgisLayer.visible;
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
});
