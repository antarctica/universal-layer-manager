import type { SingleTimeInfo } from '@ulm/core';
import type { FeatureCollection } from 'geojson';
import type { LayerSpecification, MapLibreAdapterOptions, MapLibreLayerStyle, SourceSpecification, StyleSpecification } from '../src/types';
import { isSingleTimeInfo, LayerManager } from '@ulm/core';
import * as maplibregl from 'maplibre-gl';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { MapLibreLayerManagerAdapter } from '../src/maplibre-adapter';

type LayerData = MapLibreLayerStyle;
type CirclePaint = Extract<LayerSpecification, { type: 'circle' }>['paint'];

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

// An inline basemap, so the tests fetch nothing: a background and a label layer.
// The source has no features, so the glyphs are never requested.
const BASEMAP = {
  version: 8,
  glyphs: 'http://localhost/fonts/{fontstack}/{range}.pbf',
  sources: { basemap: { type: 'geojson', data: EMPTY } },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': '#eeeeee' } },
    { id: 'labels', type: 'symbol', source: 'basemap', layout: { 'text-field': ['get', 'name'] } },
  ],
} satisfies StyleSpecification;

// A second basemap to switch to, with its own label layer.
const DARK_BASEMAP = {
  ...BASEMAP,
  layers: [
    { id: 'night', type: 'background', paint: { 'background-color': '#111111' } },
    { id: 'place-names', type: 'symbol', source: 'basemap', layout: { 'text-field': ['get', 'name'] } },
  ],
} satisfies StyleSpecification;

const mapErrors = new WeakMap<maplibregl.Map, string[]>();

/** The map's errors so far, cleared so that the end of the test does not fail on them. */
function takeErrors(map: maplibregl.Map): string[] {
  return mapErrors.get(map)?.splice(0) ?? [];
}

/** A map whose style is still loading. */
function createMap(style: StyleSpecification = BASEMAP): maplibregl.Map {
  const container = document.createElement('div');
  container.style.width = '400px';
  container.style.height = '400px';
  document.body.append(container);

  const map = new maplibregl.Map({ container, style, center: [0, 0], zoom: 2, attributionControl: false });
  // MapLibre reports a rejected style change as an error event, not a throw.
  const errors: string[] = [];
  mapErrors.set(map, errors);
  map.on('error', ({ error }) => errors.push(error.message));
  onTestFinished(() => {
    map.remove();
    container.remove();
    expect(errors, 'MapLibre errors').toEqual([]);
  });
  return map;
}

function attachManager(map: maplibregl.Map, options: Partial<MapLibreAdapterOptions<LayerData>> = {}) {
  const manager = new LayerManager<LayerData>();
  manager.setAdapter(new MapLibreLayerManagerAdapter<LayerData>(map, {
    renderLayer: (info) => info.layerData,
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
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layerGroup' as const } };
}

function rivers(): LayerData {
  return {
    sources: { rivers: { type: 'geojson', data: EMPTY } },
    layers: [
      { id: 'rivers-casing', type: 'line', source: 'rivers' },
      { id: 'rivers-line', type: 'line', source: 'rivers' },
    ],
  };
}

// Reads the same source as rivers().
function riverNames(): LayerData {
  return {
    sources: { rivers: { type: 'geojson', data: EMPTY } },
    layers: [{ id: 'river-names', type: 'symbol', source: 'rivers' }],
  };
}

const THAMES: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-0.5, 51.5], [0.1, 51.5]] } }],
};

function lakes(): LayerData {
  return {
    sources: { lakes: { type: 'geojson', data: EMPTY } },
    layers: [
      { id: 'lakes-water', type: 'fill', source: 'lakes', paint: { 'fill-opacity': 0.6 } },
      { id: 'lakes-shore', type: 'line', source: 'lakes', paint: { 'line-opacity': 0.8 } },
    ],
  };
}

function points(paint: CirclePaint = {}): LayerData {
  return {
    sources: { points: { type: 'geojson', data: EMPTY } },
    layers: [{ id: 'points', type: 'circle', source: 'points', paint }],
  };
}

type PaintProperty = Parameters<maplibregl.Map['getPaintProperty']>[1];

// A 1×1 PNG, so raster sources load without the network.
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const PNG_TILE = `data:image/png;base64,${PNG_BASE64}`;

// test:// URLs answer without the network: a .json URL is a TileJSON document, anything else the 1×1 PNG.
maplibregl.addProtocol('test', async ({ url }) => {
  if (url.endsWith('.json')) {
    return { data: { tilejson: '3.0.0', tiles: [url.replace(/\.json$/, '/{z}/{x}/{y}.png')] } };
  }
  return { data: Uint8Array.from(atob(PNG_BASE64), (char) => char.charCodeAt(0)).buffer };
});

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
  it('adds a layer\'s source and style layers to the map, under the IDs renderLayer gave them', async () => {
    const { map, manager } = await setup();

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    expect(overlay(map)).toEqual({
      sources: ['rivers'],
      layers: ['rivers-casing', 'rivers-line'],
    });
  });

  it('adds a layer added while the style is loading once the style has loaded', async () => {
    const map = createMap();
    const manager = attachManager(map);

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });
    await map.once('style.load');

    expect(overlay(map)).toEqual({
      sources: ['rivers'],
      layers: ['rivers-casing', 'rivers-line'],
    });
  });

  it('keeps a hidden layer\'s style layers in the style, with visibility none', async () => {
    const { map, manager } = await setup();

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: false });

    expect(overlay(map).layers).toEqual(['rivers-casing', 'rivers-line']);
    expect(visibilityOf(map, ['rivers-casing', 'rivers-line'])).toEqual(['none', 'none']);
  });

  it('shows a hidden layer\'s style layers when it is switched on', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: false });

    manager.setEnabled('rivers', true);

    expect(visibilityOf(map, ['rivers-casing', 'rivers-line'])).toEqual(['visible', 'visible']);
  });

  it('hides a group\'s layers while the group is switched off', async () => {
    const { map, manager } = await setup();
    manager.addGroup({ ...groupParams('water'), visible: true });
    manager.addLayer({ ...layerParams('rivers', rivers(), 'water'), visible: true });

    manager.setEnabled('water', false);
    expect(visibilityOf(map, ['rivers-casing', 'rivers-line'])).toEqual(['none', 'none']);

    manager.setEnabled('water', true);
    expect(visibilityOf(map, ['rivers-casing', 'rivers-line'])).toEqual(['visible', 'visible']);
  });

  it('fades a line layer with line-layer-opacity and leaves its line-opacity alone', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('lakes', lakes()), visible: true });

    manager.setOpacity('lakes', 0.5);

    expect(paintOf(map, 'lakes-shore', ['line-layer-opacity', 'line-opacity'])).toEqual([0.5, 0.8]);
  });

  it('fades a fill layer with fill-layer-opacity and leaves its fill-opacity alone', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('lakes', lakes()), visible: true });

    manager.setOpacity('lakes', 0.5);

    expect(paintOf(map, 'lakes-water', ['fill-layer-opacity', 'fill-opacity'])).toEqual([0.5, 0.6]);
  });

  it('fades a layer by its opacity combined with its group\'s as soon as it is added', async () => {
    const { map, manager } = await setup();
    manager.addGroup({ layerConfig: { ...groupParams('water').layerConfig, opacity: 0.5 }, visible: true });

    manager.addLayer({ layerConfig: { ...layerParams('lakes', lakes(), 'water').layerConfig, opacity: 0.8 }, visible: true });

    expect(map.getPaintProperty('lakes-shore', 'line-layer-opacity')).toBeCloseTo(0.4);
  });

  it('fades a circle layer by scaling its circle-opacity and circle-stroke-opacity', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('points', points({ 'circle-opacity': 0.8 })), visible: true });

    manager.setOpacity('points', 0.5);

    expect(paintOf(map, 'points', ['circle-opacity', 'circle-stroke-opacity'])).toEqual([0.4, 0.5]);
  });

  it('puts a circle layer\'s own opacity back when it is fully opaque again', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('points', points({ 'circle-opacity': 0.8 })), visible: true });
    manager.setOpacity('points', 0.5);

    manager.setOpacity('points', 1);

    expect(paintOf(map, 'points', ['circle-opacity', 'circle-stroke-opacity'])).toEqual([0.8, undefined]);
  });

  it('scales the outputs of a zoom interpolate and keeps it the outermost expression', async () => {
    const { map, manager } = await setup();
    manager.addLayer({
      ...layerParams('points', points({ 'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 10, 0.8] })),
      visible: true,
    });

    manager.setOpacity('points', 0.5);

    expect(map.getPaintProperty('points', 'circle-opacity')).toEqual(['interpolate', ['linear'], ['zoom'], 5, 0.1, 10, 0.4]);
  });

  it('scales the outputs of a zoom step and keeps it the outermost expression', async () => {
    const { map, manager } = await setup();
    manager.addLayer({
      ...layerParams('points', points({ 'circle-opacity': ['step', ['zoom'], 0.4, 8, 0.8] })),
      visible: true,
    });

    manager.setOpacity('points', 0.5);

    expect(map.getPaintProperty('points', 'circle-opacity')).toEqual(['step', ['zoom'], 0.2, 8, 0.4]);
  });

  it('multiplies a data-driven opacity by the layer\'s opacity', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('points', points({ 'circle-opacity': ['get', 'alpha'] })), visible: true });

    manager.setOpacity('points', 0.5);

    expect(map.getPaintProperty('points', 'circle-opacity')).toEqual(['*', 0.5, ['get', 'alpha']]);
  });

  it.each(OWN_OPACITY_CASES)('fades a $layer.type layer by scaling its own opacity', async ({ layer, source, properties }) => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('shading', { sources: source ? { tiles: source } : {}, layers: [layer] }), visible: true });

    manager.setOpacity('shading', 0.5);

    expect(paintOf(map, 'shade', properties)).toEqual(properties.map(() => 0.4));
  });

  it('scales a circle layer\'s own opacity by its group\'s as soon as it is added', async () => {
    const { map, manager } = await setup();
    manager.addGroup({ layerConfig: { ...groupParams('places').layerConfig, opacity: 0.5 }, visible: true });

    manager.addLayer({ ...layerParams('points', points({ 'circle-opacity': 0.8 }), 'places'), visible: true });

    expect(paintOf(map, 'points', ['circle-opacity', 'circle-stroke-opacity'])).toEqual([0.4, 0.5]);
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

    expect(map.getStyle().layers.find((layer) => layer.id === 'shade')?.paint).toEqual({ 'hillshade-exaggeration': 0.6 });
  });

  it('removes a layer\'s style layers and source from the map when it is removed', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    manager.removeLayer('rivers');

    expect(overlay(map)).toEqual({ sources: [], layers: [] });
  });

  it('keeps a shared source on the map until the last layer that reads it is removed', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });
    manager.addLayer({ ...layerParams('river-names', riverNames()), visible: true });

    manager.removeLayer('rivers');
    expect(overlay(map)).toEqual({ sources: ['rivers'], layers: ['river-names'] });

    manager.removeLayer('river-names');
    expect(overlay(map)).toEqual({ sources: [], layers: [] });
  });

  it('keeps a layer\'s source on the map while a style layer the app added still reads it', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });
    map.addLayer({ id: 'app-highlight', type: 'line', source: 'rivers' });

    manager.removeLayer('rivers');

    expect(overlay(map)).toEqual({ sources: ['rivers'], layers: ['app-highlight'] });
  });

  it('removes every source and style layer it added when the adapter is detached', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });
    manager.addLayer({ ...layerParams('lakes', lakes()), visible: true });

    manager.setAdapter(null);

    expect(overlay(map)).toEqual({ sources: [], layers: [] });
  });

  it('removes every source and style layer it added when the manager is reset', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });
    manager.addLayer({ ...layerParams('river-names', riverNames()), visible: true });

    manager.reset();

    expect(overlay(map)).toEqual({ sources: [], layers: [] });
  });

  it('draws a layer\'s style layers below the basemap\'s first label layer, in the order renderLayer gave them', async () => {
    const { map, manager } = await setup();

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true, position: 'top' });

    expect(map.getLayersOrder()).toEqual(['land', 'rivers-casing', 'rivers-line', 'labels']);
  });

  it('restacks the style layers in the manager\'s order when a layer moves, keeping each layer\'s together', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('lakes', lakes()), visible: true, position: 'top' });

    manager.moveLayer('rivers', { parentId: null, position: 'top' });

    expect(map.getLayersOrder()).toEqual([
      'land',
      'lakes-water',
      'lakes-shore',
      'rivers-casing',
      'rivers-line',
      'labels',
    ]);
  });

  it('draws its own symbol layers below the basemap\'s labels with the rest', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('river-names', riverNames()), visible: true, position: 'top' });

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true, position: 'top' });

    expect(map.getLayersOrder()).toEqual(['land', 'river-names', 'rivers-casing', 'rivers-line', 'labels']);
  });

  it('draws layers below the drawBelow layer when the map has it', async () => {
    const { map, manager } = await setup({ drawBelow: 'land' });

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true, position: 'top' });

    expect(map.getLayersOrder()).toEqual(['rivers-casing', 'rivers-line', 'land', 'labels']);
  });

  it('draws layers below the first label layer when the map lacks the drawBelow layer', async () => {
    const { map, manager } = await setup({ drawBelow: 'missing' });

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true, position: 'top' });

    expect(map.getLayersOrder()).toEqual(['land', 'rivers-casing', 'rivers-line', 'labels']);
  });

  it('draws layers on top when the map has no label layer', async () => {
    const map = createMap({ ...BASEMAP, layers: [BASEMAP.layers[0]] });
    await map.once('style.load');
    const manager = attachManager(map);

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true, position: 'top' });

    expect(map.getLayersOrder()).toEqual(['land', 'rivers-casing', 'rivers-line']);
  });

  it('stacks layers added while the style is loading in the manager\'s order once it loads', async () => {
    const map = createMap();
    const manager = attachManager(map);
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('lakes', lakes()), visible: true, position: 'bottom' });

    await map.once('style.load');

    expect(map.getLayersOrder()).toEqual([
      'land',
      'lakes-water',
      'lakes-shore',
      'rivers-casing',
      'rivers-line',
      'labels',
    ]);
  });

  it('stacks the layers in a group in the group\'s place and skips the group itself', async () => {
    const { map, manager } = await setup();
    manager.addGroup({ ...groupParams('water'), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('lakes', lakes(), 'water'), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('rivers', rivers(), 'water'), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('river-names', riverNames()), visible: true, position: 'top' });

    manager.moveLayer('water', { parentId: null, position: 'top' });

    expect(map.getLayersOrder()).toEqual([
      'land',
      'river-names',
      'lakes-water',
      'lakes-shore',
      'rivers-casing',
      'rivers-line',
      'labels',
    ]);
  });

  it('draws layers above symbol layers without text, such as one-way arrows, and below the first label layer', async () => {
    const arrows: LayerSpecification = { id: 'arrows', type: 'symbol', source: 'basemap', layout: { 'icon-image': 'arrow' } };
    const map = createMap({ ...BASEMAP, layers: [BASEMAP.layers[0], arrows, BASEMAP.layers[1]] });
    await map.once('style.load');
    const manager = attachManager(map);

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true, position: 'top' });

    expect(map.getLayersOrder()).toEqual(['land', 'arrows', 'rivers-casing', 'rivers-line', 'labels']);
  });

  it('gives a GeoJSON source new data in place when the layer\'s data changes', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });
    const source = map.getSource<maplibregl.GeoJSONSource>('rivers');

    manager.updateLayerData('rivers', { ...rivers(), sources: { rivers: { type: 'geojson', data: THAMES } } });

    expect(map.getSource('rivers')).toBe(source);
    await expect(source?.getData()).resolves.toEqual(THAMES);
  });

  it('recreates a GeoJSON source when an option other than data changes, and keeps the layer in its place', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('lakes', lakes()), visible: true, position: 'top' });
    const source = map.getSource('rivers');

    manager.updateLayerData('rivers', { ...rivers(), sources: { rivers: { type: 'geojson', data: EMPTY, tolerance: 1 } } });

    expect(map.getSource('rivers')).not.toBe(source);
    expect(map.getLayersOrder()).toEqual(['land', 'rivers-casing', 'rivers-line', 'lakes-water', 'lakes-shore', 'labels']);
  });

  it('recreates a source whose type changes and draws its layer hidden and faded as before', async () => {
    const { map, manager } = await setup();
    const picture: SourceSpecification = { type: 'image', url: PNG_TILE, coordinates: [[-1, 1], [1, 1], [1, -1], [-1, -1]] };
    const tiles: SourceSpecification = { type: 'raster', tiles: ['test://2026/{z}/{x}/{y}.png'], tileSize: 256 };
    const layers: LayerSpecification[] = [{ id: 'tiles', type: 'raster', source: 'imagery', paint: { 'raster-opacity': 0.8 } }];
    manager.addLayer({ ...layerParams('imagery', { sources: { imagery: picture }, layers }), visible: false });
    manager.setOpacity('imagery', 0.5);
    const source = map.getSource('imagery');

    manager.updateLayerData('imagery', { sources: { imagery: tiles }, layers });

    expect(map.getSource('imagery')).not.toBe(source);
    expect(map.getSource('imagery')?.type).toBe('raster');
    expect(visibilityOf(map, ['tiles'])).toEqual(['none']);
    expect(map.getPaintProperty('tiles', 'raster-opacity')).toBe(0.4);
  });

  it('draws a layer\'s latest data once the style loads when the data changed while it was loading', async () => {
    const map = createMap();
    const manager = attachManager(map);
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });
    manager.updateLayerData('rivers', { ...rivers(), sources: { rivers: { type: 'geojson', data: THAMES } } });

    await map.once('style.load');

    await expect(map.getSource<maplibregl.GeoJSONSource>('rivers')?.getData()).resolves.toEqual(THAMES);
  });

  it('replaces a layer\'s style layers with the new ones when its data changes', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    manager.updateLayerData('rivers', { ...rivers(), layers: [{ id: 'rivers-line', type: 'line', source: 'rivers', paint: { 'line-color': '#0000ff' } }] });

    expect(overlay(map).layers).toEqual(['rivers-line']);
    expect(map.getPaintProperty('rivers-line', 'line-color')).toBe('#0000ff');
  });

  it('takes a layer off the map while renderLayer returns null, and draws it when renderLayer returns a style again', async () => {
    const { map, manager } = await setup({ renderLayer: (info) => (info.layerData.layers.length > 0 ? info.layerData : null) });
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    manager.updateLayerData('rivers', { layers: [] });
    expect(overlay(map)).toEqual({ sources: [], layers: [] });

    manager.updateLayerData('rivers', rivers());
    expect(overlay(map)).toEqual({ sources: ['rivers'], layers: ['rivers-casing', 'rivers-line'] });
  });

  it('keeps a layer\'s unchanged source when only its style layers change', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });
    const source = map.getSource('rivers');

    manager.updateLayerData('rivers', { ...rivers(), layers: [{ id: 'rivers-line', type: 'line', source: 'rivers', paint: { 'line-color': '#0000ff' } }] });

    expect(map.getSource('rivers')).toBe(source);
  });

  it('gives a raster source new tile URLs in place, so the old tiles show until the new ones load', async () => {
    const { map, manager } = await setup();
    const imagery = (tiles: string[]): LayerData => ({
      sources: { imagery: { type: 'raster', tiles, tileSize: 256 } },
      layers: [{ id: 'tiles', type: 'raster', source: 'imagery' }],
    });
    manager.addLayer({ ...layerParams('imagery', imagery(['test://2025/{z}/{x}/{y}.png'])), visible: true });
    const source = map.getSource<maplibregl.RasterTileSource>('imagery');

    manager.updateLayerData('imagery', imagery(['test://2026/{z}/{x}/{y}.png']));

    expect(map.getSource('imagery')).toBe(source);
    expect(source?.serialize().tiles).toEqual(['test://2026/{z}/{x}/{y}.png']);
  });

  it('gives a tile source a new TileJSON URL in place, so the old tiles show until the new ones load', async () => {
    const { map, manager } = await setup();
    const imagery = (url: string): LayerData => ({
      sources: { imagery: { type: 'raster', url, tileSize: 256 } },
      layers: [{ id: 'tiles', type: 'raster', source: 'imagery' }],
    });
    manager.addLayer({ ...layerParams('imagery', imagery('test://2025.json')), visible: true });
    const source = map.getSource<maplibregl.RasterTileSource>('imagery');

    manager.updateLayerData('imagery', imagery('test://2026.json'));

    expect(map.getSource('imagery')).toBe(source);
    expect(source?.serialize().url).toBe('test://2026.json');
  });

  it('draws its layers below the new basemap\'s labels after the app changes the style', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true, position: 'top' });

    map.setStyle(DARK_BASEMAP);

    expect(map.getLayersOrder()).toEqual(['night', 'rivers-casing', 'rivers-line', 'place-names']);
  });

  it('draws its layers hidden and faded as before after the app rebuilds the style without a diff', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('lakes', lakes()), visible: false, position: 'top' });
    manager.setOpacity('lakes', 0.5);

    map.setStyle(DARK_BASEMAP, { diff: false });
    await map.once('style.load');

    expect(map.getLayersOrder()).toEqual(['night', 'lakes-water', 'lakes-shore', 'place-names']);
    expect(visibilityOf(map, ['lakes-water', 'lakes-shore'])).toEqual(['none', 'none']);
    expect(map.getPaintProperty('lakes-water', 'fill-layer-opacity')).toBe(0.5);
  });

  it('adds a layer added while the app rebuilds the style once the new style has loaded', async () => {
    const { map, manager } = await setup();
    map.setStyle(DARK_BASEMAP, { diff: false });

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true, position: 'top' });
    await map.once('style.load');

    expect(map.getLayersOrder()).toEqual(['night', 'rivers-casing', 'rivers-line', 'place-names']);
  });

  it('draws a layer whose data is a MapLibre style when the adapter has no renderLayer', async () => {
    const map = createMap();
    await map.once('style.load');
    const manager = new LayerManager<LayerData>();
    manager.setAdapter(new MapLibreLayerManagerAdapter<LayerData>(map));

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    expect(overlay(map)).toEqual({ sources: ['rivers'], layers: ['rivers-casing', 'rivers-line'] });
  });

  it('leaves a layer whose data is not a MapLibre style off the map when the adapter has no renderLayer', async () => {
    const map = createMap();
    await map.once('style.load');
    const manager = new LayerManager<{ url: string }>();
    manager.setAdapter(new MapLibreLayerManagerAdapter<{ url: string }>(map));

    manager.addLayer({ layerConfig: { layerId: 'rivers', layerName: 'Rivers', layerType: 'layer', layerData: { url: 'rivers.geojson' } }, visible: true });

    expect(overlay(map)).toEqual({ sources: [], layers: [] });
  });

  it('gives a tile source the URLs renderLayer builds for the layer\'s new time, in place', async () => {
    const imagery = (date: string): LayerData => ({
      sources: { imagery: { type: 'raster', tiles: [`test://${date}/{z}/{x}/{y}.png`], tileSize: 256 } },
      layers: [{ id: 'tiles', type: 'raster', source: 'imagery' }],
    });
    const { map, manager } = await setup({
      renderLayer: (info) => imagery(isSingleTimeInfo(info.timeInfo) ? info.timeInfo.value.toString() : 'latest'),
    });
    manager.addLayer({ ...layerParams('imagery', imagery('latest')), visible: true });
    const source = map.getSource<maplibregl.RasterTileSource>('imagery');
    const newYearsDay: SingleTimeInfo = { type: 'single', precision: 'date', value: Temporal.PlainDate.from('2026-01-01') };

    manager.setTimeInfo('imagery', newYearsDay);

    expect(map.getSource('imagery')).toBe(source);
    expect(source?.serialize().tiles).toEqual(['test://2026-01-01/{z}/{x}/{y}.png']);
  });

  it('leaves the map alone when renderLayer returns the same style for the layer\'s new time', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });
    const source = map.getSource('rivers');
    const styleLayer = map.getLayer('rivers-line');
    const newYearsDay: SingleTimeInfo = { type: 'single', precision: 'date', value: Temporal.PlainDate.from('2026-01-01') };

    manager.setTimeInfo('rivers', newYearsDay);

    expect(map.getSource('rivers')).toBe(source);
    expect(map.getLayer('rivers-line')).toBe(styleLayer);
  });

  it('leaves a layer off the map, and reports it, when the map already has a style layer with one of its IDs', async () => {
    const { map, manager } = await setup();

    manager.addLayer({ ...layerParams('rivers', { ...rivers(), layers: [{ id: 'labels', type: 'line', source: 'rivers' }] }), visible: true });

    expect(overlay(map)).toEqual({ sources: [], layers: [] });
    expect(map.getLayer('labels')?.type).toBe('symbol');
    expect(takeErrors(map)).toEqual(['Layer "rivers" is not drawn: the map already has a style layer "labels".']);
  });

  it('leaves the map\'s own style layer alone when a layer refused for using its ID is hidden, faded, moved or removed', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('lakes', lakes()), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('rivers', { ...rivers(), layers: [{ id: 'labels', type: 'symbol', source: 'rivers' }] }), visible: true, position: 'top' });
    takeErrors(map);

    manager.setEnabled('rivers', false);
    manager.setOpacity('rivers', 0.5);
    manager.moveLayer('rivers', { parentId: null, position: 'bottom' });
    manager.removeLayer('rivers');

    expect(map.getLayer('labels')?.type).toBe('symbol');
    expect(visibilityOf(map, ['labels'])).toEqual([undefined]);
    expect(paintOf(map, 'labels', ['text-opacity', 'icon-opacity'])).toEqual([undefined, undefined]);
    expect(map.getLayersOrder()).toEqual(['land', 'lakes-water', 'lakes-shore', 'labels']);
  });

  it('leaves a layer off the map, and reports it, when the map already has a source it lists', async () => {
    const { map, manager } = await setup();

    manager.addLayer({ ...layerParams('rivers', { ...rivers(), sources: { basemap: { type: 'geojson', data: THAMES } } }), visible: true });

    expect(overlay(map)).toEqual({ sources: [], layers: [] });
    expect(takeErrors(map)).toEqual(['Layer "rivers" is not drawn: the map already has a source "basemap".']);
  });

  it('treats a style layer from a new style as the style\'s own, even when this adapter used its ID before', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    map.setStyle({ ...DARK_BASEMAP, layers: [...DARK_BASEMAP.layers, { id: 'rivers-line', type: 'background' }] }, { diff: false });
    await map.once('style.load');

    expect(map.getLayer('rivers-line')?.type).toBe('background');
    expect(takeErrors(map)).toEqual(['Layer "rivers" is not drawn: the map already has a style layer "rivers-line".']);
  });

  it('draws a style layer that reads a basemap source it does not list', async () => {
    const { map, manager } = await setup();

    manager.addLayer({ ...layerParams('rivers', { layers: [{ id: 'rivers-line', type: 'line', source: 'basemap' }] }), visible: true });

    expect(overlay(map)).toEqual({ sources: [], layers: ['rivers-line'] });
    expect(map.getLayer('rivers-line')?.source).toBe('basemap');
  });

  it('leaves the basemap\'s source and style layers on the map when a layer that reads its source is removed', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', { layers: [{ id: 'rivers-line', type: 'line', source: 'basemap' }] }), visible: true });

    manager.removeLayer('rivers');

    expect(map.getSource('basemap')).toBeDefined();
    expect(map.getLayersOrder()).toEqual(['land', 'labels']);
  });

  it('draws a layer again on its source that an app\'s style layer kept on the map', async () => {
    const { map, manager } = await setup();
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });
    map.addLayer({ id: 'app-highlight', type: 'line', source: 'rivers' });
    manager.removeLayer('rivers');

    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    expect(overlay(map)).toEqual({ sources: ['rivers'], layers: ['rivers-casing', 'rivers-line', 'app-highlight'] });
  });

  it('passes a removed layer\'s style to disposeLayer', async () => {
    const disposeLayer = vi.fn();
    const { manager } = await setup({ disposeLayer });
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    manager.removeLayer('rivers');

    expect(disposeLayer).toHaveBeenCalledWith(rivers(), 'rivers');
  });

  it('passes the style renderLayer replaces to disposeLayer', async () => {
    const disposeLayer = vi.fn();
    const { manager } = await setup({ disposeLayer });
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    manager.updateLayerData('rivers', lakes());

    expect(disposeLayer).toHaveBeenCalledWith(rivers(), 'rivers');
  });

  it('keeps a style from disposeLayer when only its tile URLs change, as the source takes them in place', async () => {
    const disposeLayer = vi.fn();
    const { manager } = await setup({ disposeLayer });
    const imagery = (tiles: string[]): LayerData => ({
      sources: { imagery: { type: 'raster', tiles, tileSize: 256 } },
      layers: [{ id: 'tiles', type: 'raster', source: 'imagery' }],
    });
    manager.addLayer({ ...layerParams('imagery', imagery(['test://2025/{z}/{x}/{y}.png'])), visible: true });

    manager.updateLayerData('imagery', imagery(['test://2026/{z}/{x}/{y}.png']));

    expect(disposeLayer).not.toHaveBeenCalled();
  });

  it('passes every layer\'s style to disposeLayer when the adapter is detached', async () => {
    const disposeLayer = vi.fn();
    const { manager } = await setup({ disposeLayer });
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });
    manager.addLayer({ ...layerParams('lakes', lakes()), visible: false });

    manager.setAdapter(null);

    expect(disposeLayer.mock.calls).toEqual(expect.arrayContaining([[rivers(), 'rivers'], [lakes(), 'lakes']]));
    expect(disposeLayer).toHaveBeenCalledTimes(2);
  });

  it('keeps a hidden layer\'s style from disposeLayer, as it comes back when shown', async () => {
    const disposeLayer = vi.fn();
    const { manager } = await setup({ disposeLayer });
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    manager.setEnabled('rivers', false);

    expect(disposeLayer).not.toHaveBeenCalled();
  });

  it('keeps a style from disposeLayer when only its GeoJSON data changes', async () => {
    const disposeLayer = vi.fn();
    const { manager } = await setup({ disposeLayer });
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    manager.updateLayerData('rivers', { ...rivers(), sources: { rivers: { type: 'geojson', data: THAMES } } });

    expect(disposeLayer).not.toHaveBeenCalled();
  });

  it('passes a layer\'s style to disposeLayer when renderLayer returns null for its new data', async () => {
    const disposeLayer = vi.fn();
    const { manager } = await setup({ disposeLayer, renderLayer: (info) => (info.layerData.layers.length > 0 ? info.layerData : null) });
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    manager.updateLayerData('rivers', { layers: [] });

    expect(disposeLayer).toHaveBeenCalledWith(rivers(), 'rivers');
  });

  it('passes the style renderLayer drew last time to it as current when the layer\'s data changes', async () => {
    const renderLayer = vi.fn((info: { layerData: LayerData }) => info.layerData);
    const { manager } = await setup({ renderLayer });
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });

    manager.updateLayerData('rivers', lakes());

    expect(renderLayer).toHaveBeenLastCalledWith(expect.objectContaining({ layerId: 'rivers' }), expect.anything(), rivers());
  });

  it('leaves the map alone when renderLayer returns current for the layer\'s new time', async () => {
    const { map, manager } = await setup({ renderLayer: (info, _map, current) => current ?? info.layerData });
    manager.addLayer({ ...layerParams('rivers', rivers()), visible: true });
    const styleLayer = map.getLayer('rivers-line');
    const newYearsDay: SingleTimeInfo = { type: 'single', precision: 'date', value: Temporal.PlainDate.from('2026-01-01') };

    manager.setTimeInfo('rivers', newYearsDay);

    expect(map.getLayer('rivers-line')).toBe(styleLayer);
  });

  it('passes a style to disposeLayer when its image source gets a new URL, as MapLibre adds that source again', async () => {
    const disposeLayer = vi.fn();
    const { manager } = await setup({ disposeLayer });
    const picture = (url: string): LayerData => ({
      sources: { picture: { type: 'image', url, coordinates: [[-1, 1], [1, 1], [1, -1], [-1, -1]] } },
      layers: [{ id: 'picture', type: 'raster', source: 'picture' }],
    });
    manager.addLayer({ ...layerParams('picture', picture(PNG_TILE)), visible: true });

    manager.updateLayerData('picture', picture(`${PNG_TILE}#2026`));

    expect(disposeLayer).toHaveBeenCalledWith(picture(PNG_TILE), 'picture');
  });
});
