import type { FeatureCollection } from 'geojson';
import type { LayerSpecification, MapLibreAdapterOptions, MapLibreLayerStyle, SourceSpecification, StyleSpecification } from '../src/types';
import { LayerManager } from '@ulm/core';
import * as maplibregl from 'maplibre-gl';
import { describe, expect, it, onTestFinished } from 'vitest';
import { MapLibreLayerManagerAdapter } from '../src/maplibre-adapter';

type LayerData = MapLibreLayerStyle;
type CirclePaint = Extract<LayerSpecification, { type: 'circle' }>['paint'];

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

function lakes(): LayerData {
  return {
    sources: { lakes: { type: 'geojson', data: EMPTY } },
    layers: [
      { id: 'water', type: 'fill', source: 'lakes', paint: { 'fill-opacity': 0.6 } },
      { id: 'shore', type: 'line', source: 'lakes', paint: { 'line-opacity': 0.8 } },
    ],
  };
}

function points(paint: CirclePaint = {}): LayerData {
  return {
    sources: { points: { type: 'geojson', data: EMPTY } },
    layers: [{ id: 'dots', type: 'circle', source: 'points', paint }],
  };
}

type PaintProperty = Parameters<maplibregl.Map['getPaintProperty']>[1];

// A 1×1 PNG, so raster sources load without the network.
const PNG_TILE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

interface OwnOpacityCase {
  layer: LayerSpecification;
  source?: SourceSpecification;
  properties: PaintProperty[];
}

const OWN_OPACITY_CASES: OwnOpacityCase[] = [
  {
    layer: { id: 'shade', type: 'raster', source: 'tiles', paint: { 'raster-opacity': 0.8 } },
    source: { type: 'raster', tiles: [PNG_TILE], tileSize: 256 },
    properties: ['raster-opacity'],
  },
  {
    layer: { id: 'shade', type: 'heatmap', source: 'tiles', paint: { 'heatmap-opacity': 0.8 } },
    source: { type: 'geojson', data: EMPTY },
    properties: ['heatmap-opacity'],
  },
  {
    layer: { id: 'shade', type: 'fill-extrusion', source: 'tiles', paint: { 'fill-extrusion-opacity': 0.8 } },
    source: { type: 'geojson', data: EMPTY },
    properties: ['fill-extrusion-opacity'],
  },
  {
    layer: { id: 'shade', type: 'background', paint: { 'background-opacity': 0.8 } },
    properties: ['background-opacity'],
  },
  {
    layer: { id: 'shade', type: 'color-relief', source: 'tiles', paint: { 'color-relief-opacity': 0.8 } },
    source: { type: 'raster-dem', tiles: [PNG_TILE], tileSize: 256 },
    properties: ['color-relief-opacity'],
  },
  {
    layer: { id: 'shade', type: 'symbol', source: 'tiles', paint: { 'icon-opacity': 0.8, 'text-opacity': 0.8 } },
    source: { type: 'geojson', data: EMPTY },
    properties: ['icon-opacity', 'text-opacity'],
  },
];

function paintOf(map: maplibregl.Map, layerId: string, properties: PaintProperty[]): unknown[] {
  return properties.map((property) => map.getPaintProperty(layerId, property));
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

  it('fades a line layer with line-layer-opacity and leaves its line-opacity alone', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('lakes', lakes()), visible: true });

    manager.setOpacity('lakes', 0.5);

    expect(paintOf(map, 'ulm:lakes:shore', ['line-layer-opacity', 'line-opacity'])).toEqual([0.5, 0.8]);
  });

  it('fades a fill layer with fill-layer-opacity and leaves its fill-opacity alone', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('lakes', lakes()), visible: true });

    manager.setOpacity('lakes', 0.5);

    expect(paintOf(map, 'ulm:lakes:water', ['fill-layer-opacity', 'fill-opacity'])).toEqual([0.5, 0.6]);
  });

  it('fades a layer by its opacity combined with its group\'s as soon as it is added', async () => {
    const { map, manager } = await setup();
    manager.addGroup({ layerConfig: { ...groupParams('water').layerConfig, opacity: 0.5 }, visible: true });

    manager.addLayer({ layerConfig: { ...layerParams('lakes', lakes(), 'water').layerConfig, opacity: 0.8 }, visible: true });

    expect(map.getPaintProperty('ulm:lakes:shore', 'line-layer-opacity')).toBeCloseTo(0.4);
  });

  it('fades a circle layer by scaling its circle-opacity and circle-stroke-opacity', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('points', points({ 'circle-opacity': 0.8 })), visible: true });

    manager.setOpacity('points', 0.5);

    expect(paintOf(map, 'ulm:points:dots', ['circle-opacity', 'circle-stroke-opacity'])).toEqual([0.4, 0.5]);
  });

  it('puts a circle layer\'s own opacity back when it is fully opaque again', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('points', points({ 'circle-opacity': 0.8 })), visible: true });
    manager.setOpacity('points', 0.5);

    manager.setOpacity('points', 1);

    expect(paintOf(map, 'ulm:points:dots', ['circle-opacity', 'circle-stroke-opacity'])).toEqual([0.8, undefined]);
  });

  it('scales the outputs of a zoom interpolate and keeps it the outermost expression', async () => {
    const { map, manager } = await setup();
    manager.addLayer({
      ...layerParams('points', points({ 'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 10, 0.8] })),
      visible: true,
    });

    manager.setOpacity('points', 0.5);

    expect(map.getPaintProperty('ulm:points:dots', 'circle-opacity')).toEqual(['interpolate', ['linear'], ['zoom'], 5, 0.1, 10, 0.4]);
  });

  it('scales the outputs of a zoom step and keeps it the outermost expression', async () => {
    const { map, manager } = await setup();
    manager.addLayer({
      ...layerParams('points', points({ 'circle-opacity': ['step', ['zoom'], 0.4, 8, 0.8] })),
      visible: true,
    });

    manager.setOpacity('points', 0.5);

    expect(map.getPaintProperty('ulm:points:dots', 'circle-opacity')).toEqual(['step', ['zoom'], 0.2, 8, 0.4]);
  });

  it('multiplies a data-driven opacity by the layer\'s opacity', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('points', points({ 'circle-opacity': ['get', 'alpha'] })), visible: true });

    manager.setOpacity('points', 0.5);

    expect(map.getPaintProperty('ulm:points:dots', 'circle-opacity')).toEqual(['*', 0.5, ['get', 'alpha']]);
  });

  it.each(OWN_OPACITY_CASES)('fades a $layer.type layer by scaling its own opacity', async ({ layer, source, properties }) => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('shading', { sources: source ? { tiles: source } : {}, layers: [layer] }), visible: true });

    manager.setOpacity('shading', 0.5);

    expect(paintOf(map, 'ulm:shading:shade', properties)).toEqual(properties.map(() => 0.4));
  });

  it('scales a circle layer\'s own opacity by its group\'s as soon as it is added', async () => {
    const { map, manager } = await setup();
    manager.addGroup({ layerConfig: { ...groupParams('places').layerConfig, opacity: 0.5 }, visible: true });

    manager.addLayer({ ...layerParams('points', points({ 'circle-opacity': 0.8 }), 'places'), visible: true });

    expect(paintOf(map, 'ulm:points:dots', ['circle-opacity', 'circle-stroke-opacity'])).toEqual([0.4, 0.5]);
  });

  it('leaves a hillshade layer\'s paint alone when it is faded, as hillshade has no opacity', async () => {
    const { map, manager } = await setup();
    manager.addLayer({
      ...layerParams('relief', {
        sources: { dem: { type: 'raster-dem', tiles: [PNG_TILE], tileSize: 256 } },
        layers: [{ id: 'shade', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.6 } }],
      }),
      visible: true,
    });

    manager.setOpacity('relief', 0.5);

    expect(map.getStyle().layers.find((layer) => layer.id === 'ulm:relief:shade')?.paint).toEqual({ 'hillshade-exaggeration': 0.6 });
  });
});
