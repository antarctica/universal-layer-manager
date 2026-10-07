import type { LeafletAdapterOptions } from '../src/types';
import { LayerManager } from '@ulm/core';
import * as L from 'leaflet';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { LeafletLayerManagerAdapter } from '../src/leaflet-adapter';
import 'leaflet/dist/leaflet.css';

interface LayerData {
  leafletLayer: L.Layer;
}

type Manager = LayerManager<LayerData>;

const LONDON: L.LatLngTuple = [51.505, -0.09];

function setup(options: LeafletAdapterOptions<LayerData> = {}) {
  const container = document.createElement('div');
  container.style.width = '400px';
  container.style.height = '400px';
  document.body.append(container);

  const map = L.map(container, { center: LONDON, zoom: 13 });
  const manager: Manager = new LayerManager<LayerData>({ allowNestedGroupLayers: true });
  manager.setAdapter(new LeafletLayerManagerAdapter<LayerData>(map, options));

  let attached = true;
  const detach = () => {
    manager.setAdapter(null);
    attached = false;
  };

  onTestFinished(() => {
    if (attached) {
      expectMapToMatchTree(manager, map);
    }
    map.remove();
    container.remove();
  });
  return { map, manager, detach };
}

/** What the map shows matches the manager's tree: who is on the map, at what opacity, in what order. */
function expectMapToMatchTree(manager: Manager, map: L.Map) {
  const { rootIds, layers } = manager.getTree();
  const flatOrder = (ids: readonly string[]): string[] => ids.flatMap((id) => {
    const info = layers[id];
    return [id, ...(info?.layerType === 'layerGroup' ? flatOrder(info.childIds) : [])];
  });

  const zIndexes: number[] = [];
  for (const layerId of flatOrder(rootIds)) {
    const info = layers[layerId];
    if (info?.layerType !== 'layer') {
      continue;
    }
    const { leafletLayer } = info.layerData;
    expect(map.hasLayer(leafletLayer), `${layerId} on the map`).toBe(info.visible);
    expect(opacityOf(map, leafletLayer), `${layerId} opacity`).toBeCloseTo(info.computedOpacity);
    zIndexes.push(Number(getComputedStyle(paneOf(map, leafletLayer)).zIndex));
  }
  expect(zIndexes, 'panes stacked in the manager\'s order').toEqual([...zIndexes].sort((a, b) => a - b));
}

function paneOf(map: L.Map, leafletLayer: L.Layer): HTMLElement {
  const pane = map.getPane(leafletLayer.options.pane ?? '');
  if (!pane) {
    throw new Error(`No pane for ${leafletLayer.options.pane}`);
  }
  return pane;
}

// The opacity the browser draws a layer at.
function opacityOf(map: L.Map, leafletLayer: L.Layer): number {
  return Number(getComputedStyle(paneOf(map, leafletLayer)).opacity);
}

// The layers drawn at a point on the map, from the bottom up, as the browser stacks them.
function drawOrderAt(manager: Manager, map: L.Map, latLng: L.LatLngExpression): string[] {
  const idsByElement = new Map<Element, string>();
  for (const info of Object.values(manager.getTree().layers)) {
    const { leafletLayer } = info.layerData ?? {};
    const element = leafletLayer instanceof L.Path ? leafletLayer.getElement() : undefined;
    if (element) {
      idsByElement.set(element, info.layerId);
    }
  }
  const box = map.getContainer().getBoundingClientRect();
  const point = map.latLngToContainerPoint(latLng);
  return document.elementsFromPoint(box.left + point.x, box.top + point.y)
    .flatMap((element) => idsByElement.get(element) ?? [])
    .reverse();
}

function circle(): L.CircleMarker {
  return L.circleMarker(LONDON, { radius: 20 });
}

function layerParams(layerId: string, leafletLayer: L.Layer, parentId: string | null = null) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layer' as const, parentId, layerData: { leafletLayer } } };
}

function groupParams(layerId: string) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layerGroup' as const, parentId: null, layerData: undefined } };
}

describe('leafletLayerManagerAdapter', () => {
  it('puts a visible layer on the map when it is added', () => {
    const { map, manager } = setup();
    const leafletLayer = circle();

    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });

    expect(map.hasLayer(leafletLayer)).toBe(true);
  });

  it('keeps a hidden layer off the map until it is shown', () => {
    const { map, manager } = setup();
    const leafletLayer = circle();
    manager.addLayer(layerParams('layer-1', leafletLayer));
    expect(map.hasLayer(leafletLayer)).toBe(false);

    manager.setEnabled('layer-1', true);

    expect(map.hasLayer(leafletLayer)).toBe(true);
  });

  it('takes a layer off the map when it is hidden', () => {
    const { map, manager } = setup();
    const leafletLayer = circle();
    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });

    manager.setEnabled('layer-1', false);

    expect(map.hasLayer(leafletLayer)).toBe(false);
  });

  it('takes a group\'s layers off the map while the group is hidden', () => {
    const { map, manager } = setup();
    const leafletLayer = circle();
    manager.addGroup({ ...groupParams('group-1'), visible: true });
    manager.addLayer({ ...layerParams('child-1', leafletLayer, 'group-1'), visible: true });

    manager.setEnabled('group-1', false);
    expect(map.hasLayer(leafletLayer)).toBe(false);

    manager.setEnabled('group-1', true);
    expect(map.hasLayer(leafletLayer)).toBe(true);
  });

  it('draws a layer at its opacity combined with its group\'s', () => {
    const { map, manager } = setup();
    const leafletLayer = circle();
    manager.addGroup(groupParams('group-1'));
    manager.addLayer(layerParams('child-1', leafletLayer, 'group-1'));

    manager.setOpacity('group-1', 0.5);
    manager.setOpacity('child-1', 0.8);

    expect(opacityOf(map, leafletLayer)).toBeCloseTo(0.4);
  });

  it('draws a layer at its opacity combined with its group\'s as soon as it is added', () => {
    const { map, manager } = setup();
    const leafletLayer = circle();
    manager.addGroup({ layerConfig: { ...groupParams('group-1').layerConfig, opacity: 0.5 } });

    manager.addLayer({ layerConfig: { ...layerParams('child-1', leafletLayer, 'group-1').layerConfig, opacity: 0.8 } });

    expect(opacityOf(map, leafletLayer)).toBeCloseTo(0.4);
  });

  it('takes a layer off the map when it is removed', () => {
    const { map, manager } = setup();
    const leafletLayer = circle();
    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });

    manager.removeLayer('layer-1');

    expect(map.hasLayer(leafletLayer)).toBe(false);
  });

  it('removes a layer\'s pane from the map when the layer is removed', () => {
    const { map, manager } = setup();
    const leafletLayer = circle();
    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });
    const pane = paneOf(map, leafletLayer);

    manager.removeLayer('layer-1');

    expect(map.getContainer().contains(pane)).toBe(false);
  });

  it('draws a layer added again with the ID of a removed layer', () => {
    const { map, manager } = setup();
    manager.addLayer({ ...layerParams('layer-1', circle()), visible: true });
    manager.removeLayer('layer-1');
    const leafletLayer = circle();

    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });

    expect(map.getContainer().contains(leafletLayer.getElement() ?? null)).toBe(true);
  });

  it('takes every layer off the map when the manager is reset', () => {
    const { map, manager } = setup();
    const first = circle();
    const second = circle();
    manager.addLayer({ ...layerParams('layer-1', first), visible: true });
    manager.addLayer({ ...layerParams('layer-2', second), visible: true });

    manager.reset();

    expect(map.hasLayer(first)).toBe(false);
    expect(map.hasLayer(second)).toBe(false);
  });

  it('takes every layer off the map when the adapter is detached', () => {
    const { map, manager, detach } = setup();
    const leafletLayer = circle();
    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });

    detach();

    expect(map.hasLayer(leafletLayer)).toBe(false);
  });

  it('removes every pane it added when the adapter is detached', () => {
    const { map, manager, detach } = setup();
    const leafletLayer = circle();
    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });
    const panes = [paneOf(map, leafletLayer), paneOf(map, leafletLayer).parentElement];

    detach();

    expect(panes.map((pane) => map.getContainer().contains(pane))).toEqual([false, false]);
  });

  it('draws the layers again when a new adapter is attached to the same map', () => {
    const { map, manager, detach } = setup();
    const leafletLayer = circle();
    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });
    detach();

    manager.setAdapter(new LeafletLayerManagerAdapter<LayerData>(map));

    expect(map.getContainer().contains(leafletLayer.getElement() ?? null)).toBe(true);
  });

  it('draws layers in the manager\'s order, from the bottom up', () => {
    const { map, manager } = setup();
    manager.addLayer({ ...layerParams('first', circle()), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('second', circle()), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('third', circle()), visible: true, position: 'top' });

    manager.moveLayer('first', { parentId: null, position: 'top' });

    expect(drawOrderAt(manager, map, LONDON)).toEqual(['second', 'third', 'first']);
  });

  it('puts a layer back in its place in the order when it is shown again', () => {
    const { map, manager } = setup();
    manager.addLayer({ ...layerParams('bottom', circle()), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('top', circle()), visible: true, position: 'top' });

    manager.setEnabled('bottom', false);
    manager.setEnabled('bottom', true);

    expect(drawOrderAt(manager, map, LONDON)).toEqual(['bottom', 'top']);
  });

  it('draws a marker\'s shadow in the marker\'s place in the order', () => {
    const { map, manager } = setup();
    const marker = L.marker(LONDON);

    manager.addLayer({ ...layerParams('marker', marker), visible: true });

    const shadow = map.getContainer().querySelector('.leaflet-marker-shadow');
    expect(shadow?.parentElement).toBe(paneOf(map, marker));
  });

  it('draws every layer in a Leaflet layer group, such as GeoJSON, in the group\'s place in the order', () => {
    const { map, manager } = setup();
    const features: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-0.1, 51.5], [-0.08, 51.5], [-0.08, 51.51], [-0.1, 51.5]]] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-0.09, 51.505] } },
      ],
    };
    const geoJson = L.geoJSON(features);

    manager.addLayer({ ...layerParams('geojson', geoJson), visible: true });

    const pane = paneOf(map, geoJson);
    const drawn = Array.from(map.getContainer().querySelectorAll('path.leaflet-interactive, .leaflet-marker-icon, .leaflet-marker-shadow'));
    expect(drawn).toHaveLength(3);
    expect(drawn.every((element) => pane.contains(element))).toBe(true);
  });

  it('tells the onEnabledChanged hook when a layer hidden by its group is switched off', () => {
    const onEnabledChanged = vi.fn();
    const { map, manager } = setup({ hooks: { onEnabledChanged } });
    const leafletLayer = circle();
    manager.addGroup({ ...groupParams('group-1'), enabled: false });
    manager.addLayer({ ...layerParams('child-1', leafletLayer, 'group-1'), enabled: true });

    manager.setEnabled('child-1', false);

    expect(onEnabledChanged).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'child-1', enabled: false }), false, leafletLayer);
    expect(map.hasLayer(leafletLayer)).toBe(false);
  });

  it('exposes the map it draws on', () => {
    const map = L.map(document.createElement('div'));
    const adapter = new LeafletLayerManagerAdapter<LayerData>(map);

    expect(adapter.getContext()).toBe(map);
    map.remove();
  });
});
