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

function layerParams(layerId: string, arcgisLayer: Layer, parentId: string | null = null) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layer' as const, parentId, layerData: { arcgisLayer } } };
}

describe('arcGISLayerManagerAdapter', () => {
  it('puts a visible layer on the map when it is added', () => {
    const { map, manager } = setup();
    const arcgisLayer = new GraphicsLayer();

    manager.addLayer({ ...layerParams('layer-1', arcgisLayer), visible: true });

    expect(map.allLayers.includes(arcgisLayer)).toBe(true);
  });
});
