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

/** A map whose style is still loading. */
function createMap(): maplibregl.Map {
  const container = document.createElement('div');
  container.style.width = '400px';
  container.style.height = '400px';
  document.body.append(container);

  const map = new maplibregl.Map({ container, style: BASEMAP, center: [0, 0], zoom: 2, attributionControl: false });
  onTestFinished(() => {
    map.remove();
    container.remove();
  });
  return map;
}

function attachManager(map: maplibregl.Map, options: Partial<MapLibreAdapterOptions<LayerData>> = {}) {
  const manager = new LayerManager<LayerData>();
  manager.setAdapter(new MapLibreLayerManagerAdapter<LayerData>(map, {
    layerFactory: (info) => info.layerData,
    ...options,
  }));
  return manager;
}

/** A manager attached to a map whose style has loaded. */
async function setup(options: Partial<MapLibreAdapterOptions<LayerData>> = {}) {
  const map = createMap();
  await map.once('style.load');
  return { map, manager: attachManager(map, options) };
}

/** The sources and style layers on the map that the basemap did not bring, layers from the bottom up. */
function overlay(map: maplibregl.Map) {
  return {
    sources: Object.keys(map.getStyle().sources).filter((id) => !(id in BASEMAP.sources)),
    layers: map.getLayersOrder().filter((id) => !BASEMAP.layers.some((layer) => layer.id === id)),
  };
}

function visibilityOf(map: maplibregl.Map, layerIds: string[]): unknown[] {
  return layerIds.map((id) => map.getLayoutProperty(id, 'visibility'));
}

function layerParams(layerId: string, layerData: LayerData, parentId: string | null = null) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layer' as const, parentId, layerData } };
}

function groupParams(layerId: string) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layerGroup' as const, parentId: null, layerData: undefined } };
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

  it('adds a layer added while the style is loading once the style has loaded', async () => {
    const map = createMap();
    const manager = attachManager(map);

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });
    await map.once('style.load');

    expect(overlay(map)).toEqual({
      sources: ['ulm:rivers'],
      layers: ['ulm:rivers:casing', 'ulm:rivers:line'],
    });
  });

  it('keeps a hidden layer\'s style layers in the style, with visibility none', async () => {
    const { map, manager } = await setup();

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: false });

    expect(overlay(map).layers).toEqual(['ulm:rivers:casing', 'ulm:rivers:line']);
    expect(visibilityOf(map, ['ulm:rivers:casing', 'ulm:rivers:line'])).toEqual(['none', 'none']);
  });

  it('shows a hidden layer\'s style layers when it is switched on', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: false });

    manager.setEnabled('rivers', true);

    expect(visibilityOf(map, ['ulm:rivers:casing', 'ulm:rivers:line'])).toEqual(['visible', 'visible']);
  });

  it('hides a group\'s layers while the group is switched off', async () => {
    const { map, manager } = await setup();
    manager.addGroup({ ...groupParams('water'), visible: true });
    manager.addLayer({ ...layerParams('rivers', rivers(), 'water'), visible: true });

    manager.setEnabled('water', false);
    expect(visibilityOf(map, ['ulm:rivers:casing', 'ulm:rivers:line'])).toEqual(['none', 'none']);

    manager.setEnabled('water', true);
    expect(visibilityOf(map, ['ulm:rivers:casing', 'ulm:rivers:line'])).toEqual(['visible', 'visible']);
  });
});
