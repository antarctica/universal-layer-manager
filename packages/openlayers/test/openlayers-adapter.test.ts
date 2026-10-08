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

function layerParams(layerId: string, openlayersLayer: BaseLayer, parentId: string | null = null) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layer' as const, parentId, layerData: { openlayersLayer } } };
}

describe('openLayersLayerManagerAdapter', () => {
  it('puts a visible layer on the map when it is added', () => {
    const { map, manager } = setup();
    const openlayersLayer = vectorLayer();

    manager.addLayer({ ...layerParams('layer-1', openlayersLayer), visible: true });

    expect(map.getAllLayers()).toContain(openlayersLayer);
  });
});
