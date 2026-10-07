import type { FeatureCollection } from 'geojson';
import type { MapLibreAdapterOptions, MapLibreLayerStyle, StyleSpecification } from '../src/types';
import { LayerManager } from '@ulm/core';
import * as maplibregl from 'maplibre-gl';
import { describe, expect, it, onTestFinished } from 'vitest';
import { MapLibreLayerManagerAdapter } from '../src/maplibre-adapter';

type LayerData = MapLibreLayerStyle;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

// An inline basemap, so the tests fetch nothing: a background and a label layer.
const BASEMAP = {
  version: 8,
  sources: { basemap: { type: 'geojson', data: EMPTY } },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': '#eeeeee' } },
    { id: 'labels', type: 'symbol', source: 'basemap' },
  ],
} satisfies StyleSpecification;

async function setup(options: Partial<MapLibreAdapterOptions<LayerData>> = {}) {
  const container = document.createElement('div');
  container.style.width = '400px';
  container.style.height = '400px';
  document.body.append(container);

  const map = new maplibregl.Map({ container, style: BASEMAP, center: [0, 0], zoom: 2, attributionControl: false });
  onTestFinished(() => {
    map.remove();
    container.remove();
  });
  await map.once('style.load');

  const manager = new LayerManager<LayerData>();
  manager.setAdapter(new MapLibreLayerManagerAdapter<LayerData>(map, {
    layerFactory: (info) => info.layerData,
    ...options,
  }));
  return { map, manager };
}

/** The sources and style layers on the map that the basemap did not bring, layers from the bottom up. */
function overlay(map: maplibregl.Map) {
  return {
    sources: Object.keys(map.getStyle().sources).filter((id) => !(id in BASEMAP.sources)),
    layers: map.getLayersOrder().filter((id) => !BASEMAP.layers.some((layer) => layer.id === id)),
  };
}

function layerParams(layerId: string, layerData: LayerData) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layer' as const, parentId: null, layerData } };
}

function rivers(): LayerData {
  return {
    sources: { rivers: { type: 'geojson', data: EMPTY } },
    layers: [
      { id: 'casing', type: 'line', source: 'rivers' },
      { id: 'line', type: 'line', source: 'rivers' },
    ],
  };
}

describe('mapLibreLayerManagerAdapter', () => {
  it('adds a layer\'s source and style layers to the map, under prefixed IDs', async () => {
    const { map, manager } = await setup();

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    expect(overlay(map)).toEqual({
      sources: ['ulm:rivers'],
      layers: ['ulm:rivers:casing', 'ulm:rivers:line'],
    });
  });
});
