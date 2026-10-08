import type { SingleTimeInfo } from '@ulm/core';
import type { LeafletAdapterOptions } from '../src/types';
import { LayerManager } from '@ulm/core';
import * as L from 'leaflet';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defaultLeafletRenderLayer } from '../src/default-render-layer';
import { LeafletLayerManagerAdapter, leafletLayerPane } from '../src/leaflet-adapter';
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

  // The Leaflet layer renderLayer last gave the adapter for each layer, so the map can be checked against it.
  const built = new Map<string, L.Layer | null>();
  const renderLayer = options.renderLayer ?? defaultLeafletRenderLayer;
  manager.setAdapter(new LeafletLayerManagerAdapter<LayerData>(map, {
    ...options,
    renderLayer: (info, renderMap, current) => {
      const leafletLayer = renderLayer(info, renderMap, current);
      built.set(info.layerId, leafletLayer);
      return leafletLayer;
    },
  }));

  let attached = true;
  const detach = () => {
    manager.setAdapter(null);
    attached = false;
  };

  onTestFinished(() => {
    if (attached) {
      expectMapToMatchTree(manager, map, built);
    }
    map.remove();
    container.remove();
  });
  return { map, manager, detach };
}

/** What the map shows matches the manager's tree: who is on the map, at what opacity, in what order. */
function expectMapToMatchTree(manager: Manager, map: L.Map, built: Map<string, L.Layer | null>) {
  const { rootIds, layers } = manager.getTree();
  const flatOrder = (ids: readonly string[]): string[] => ids.flatMap((id) => {
    const info = layers[id];
    return [id, ...(info?.layerType === 'layerGroup' ? flatOrder(info.childIds) : [])];
  });

  const zIndexes: number[] = [];
  for (const layerId of flatOrder(rootIds)) {
    const info = layers[layerId];
    const leafletLayer = built.get(layerId);
    if (info?.layerType !== 'layer' || !leafletLayer) {
      continue;
    }
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

// Clicks the map at a point, and returns the IDs of the layers whose Leaflet layer heard the click.
async function clickAt(manager: Manager, map: L.Map, latLng: L.LatLngExpression): Promise<string[]> {
  const clicked: string[] = [];
  const listeners = Object.values(manager.getTree().layers).flatMap((info) => {
    const { leafletLayer } = info.layerData ?? {};
    if (!leafletLayer) {
      return [];
    }
    const listener = () => clicked.push(info.layerId);
    leafletLayer.on('click', listener);
    return [() => leafletLayer.off('click', listener)];
  });
  await userEvent.click(map.getContainer(), { position: map.latLngToContainerPoint(latLng) });
  listeners.forEach((off) => off());
  return clicked;
}

function circle(): L.CircleMarker {
  return L.circleMarker(LONDON, { radius: 20 });
}

// Builds its inner layer before the adapter sets its pane, as leaflet.wms does.
class WrapperLayer extends L.Layer {
  constructor(private readonly inner: L.Layer) {
    super();
  }

  override onAdd(map: L.Map): this {
    this.inner.addTo(map);
    return this;
  }

  override onRemove(map: L.Map): this {
    map.removeLayer(this.inner);
    return this;
  }
}

function layerParams(layerId: string, leafletLayer: L.Layer, parentId: string | null = null) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layer' as const, parentId, layerData: { leafletLayer } } };
}

function groupParams(layerId: string) {
  return { layerConfig: { layerId, layerName: layerId, layerType: 'layerGroup' as const } };
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

  it('lets clicks through to the layer below a layer faded out', async () => {
    const { map, manager } = setup();
    manager.addLayer({ ...layerParams('bottom', circle()), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('top', circle()), visible: true, position: 'top' });

    manager.setOpacity('top', 0);

    expect(await clickAt(manager, map, LONDON)).toEqual(['bottom']);
  });

  it('takes clicks again on a layer faded back in', async () => {
    const { map, manager } = setup();
    manager.addLayer({ ...layerParams('bottom', circle()), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('top', circle()), visible: true, position: 'top' });
    manager.setOpacity('top', 0);

    manager.setOpacity('top', 0.5);

    expect(await clickAt(manager, map, LONDON)).toEqual(['top']);
  });

  it('lets clicks through to the layer below a layer added faded out', async () => {
    const { map, manager } = setup();
    manager.addLayer({ ...layerParams('bottom', circle()), visible: true, position: 'top' });

    manager.addLayer({ layerConfig: { ...layerParams('top', circle()).layerConfig, opacity: 0 }, visible: true, position: 'top' });

    expect(await clickAt(manager, map, LONDON)).toEqual(['bottom']);
  });

  it('lets clicks through to the layer below a group faded out', async () => {
    const { map, manager } = setup();
    manager.addLayer({ ...layerParams('bottom', circle()), visible: true, position: 'top' });
    manager.addGroup({ ...groupParams('group-1'), visible: true, position: 'top' });
    manager.addLayer({ ...layerParams('child-1', circle(), 'group-1'), visible: true });

    manager.setOpacity('group-1', 0);

    expect(await clickAt(manager, map, LONDON)).toEqual(['bottom']);
  });

  it('takes clicks in the right place on a layer faded back in after the map moved', async () => {
    const { map, manager } = setup();
    manager.addLayer({ ...layerParams('layer-1', circle()), visible: true });
    manager.setOpacity('layer-1', 0);
    map.panBy([150, 100], { animate: false });

    manager.setOpacity('layer-1', 1);

    expect(await clickAt(manager, map, LONDON)).toEqual(['layer-1']);
  });

  it('draws the new Leaflet layer in place of the old one when a layer\'s data changes', () => {
    const { map, manager } = setup();
    const before = circle();
    const after = circle();
    manager.addLayer({ ...layerParams('layer-1', before), visible: true });

    manager.updateLayerData('layer-1', { leafletLayer: after });

    expect([map.hasLayer(before), map.hasLayer(after)]).toEqual([false, true]);
  });

  it('leaves a layer on the map when its data changes but its Leaflet layer stays the same', () => {
    const { manager } = setup();
    const leafletLayer = circle();
    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });
    const removed = vi.fn();
    leafletLayer.on('remove', removed);

    manager.updateLayerData('layer-1', { leafletLayer });

    expect(removed).not.toHaveBeenCalled();
  });

  it('keeps the current Leaflet layer when renderLayer returns it', () => {
    const { map, manager } = setup({ renderLayer: (info, _map, current) => current ?? info.layerData.leafletLayer });
    const before = circle();
    manager.addLayer({ ...layerParams('layer-1', before), visible: true });

    manager.updateLayerData('layer-1', { leafletLayer: circle() });

    expect(map.hasLayer(before)).toBe(true);
  });

  it('takes a layer off the map when its new data has no Leaflet layer', () => {
    const skipped = circle();
    const { map, manager } = setup({ renderLayer: (info) => (info.layerData.leafletLayer === skipped ? null : info.layerData.leafletLayer) });
    const before = circle();
    manager.addLayer({ ...layerParams('layer-1', before), visible: true });

    manager.updateLayerData('layer-1', { leafletLayer: skipped });

    expect(map.hasLayer(before)).toBe(false);
  });

  it('draws a layer renderLayer skipped once its new data has a Leaflet layer', () => {
    const skipped = circle();
    const { map, manager } = setup({ renderLayer: (info) => (info.layerData.leafletLayer === skipped ? null : info.layerData.leafletLayer) });
    manager.addLayer({ ...layerParams('bottom', circle()), visible: true });
    manager.addLayer({ ...layerParams('layer-1', skipped), visible: true, position: 'top' });
    const after = circle();

    manager.updateLayerData('layer-1', { leafletLayer: after });

    expect(map.hasLayer(after)).toBe(true);
  });

  it('draws a layer renderLayer skipped at the opacity it was given while skipped', () => {
    const skipped = circle();
    const { map, manager } = setup({ renderLayer: (info) => (info.layerData.leafletLayer === skipped ? null : info.layerData.leafletLayer) });
    manager.addLayer({ ...layerParams('layer-1', skipped), visible: true });
    manager.setOpacity('layer-1', 0.5);
    const after = circle();

    manager.updateLayerData('layer-1', { leafletLayer: after });

    expect(opacityOf(map, after)).toBeCloseTo(0.5);
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

  it('draws a layer that a Leaflet layer builds with leafletLayerPane in the Leaflet layer\'s place in the order', () => {
    const { map, manager } = setup();
    const inner = L.circleMarker(LONDON, { radius: 20, pane: leafletLayerPane('wrapper') });
    const wrapper = new WrapperLayer(inner);

    manager.addLayer({ ...layerParams('wrapper', wrapper), visible: true });

    expect(paneOf(map, wrapper).contains(inner.getElement() ?? null)).toBe(true);
  });

  it('keeps a layer off the map when it is switched off while its group hides it', () => {
    const { map, manager } = setup();
    const leafletLayer = circle();
    manager.addGroup({ ...groupParams('group-1'), enabled: false });
    manager.addLayer({ ...layerParams('child-1', leafletLayer, 'group-1'), enabled: true });

    manager.setEnabled('child-1', false);

    expect(map.hasLayer(leafletLayer)).toBe(false);
  });

  it('draws the Leaflet layer renderLayer builds for a layer\'s new time', () => {
    const newYearsDayLayer = circle();
    const { map, manager } = setup({ renderLayer: (info) => (info.timeInfo ? newYearsDayLayer : info.layerData.leafletLayer) });
    const before = circle();
    manager.addLayer({ ...layerParams('layer-1', before), visible: true });
    const newYearsDay: SingleTimeInfo = { type: 'single', precision: 'date', value: Temporal.PlainDate.from('2026-01-01') };

    manager.setTimeInfo('layer-1', newYearsDay);

    expect([map.hasLayer(before), map.hasLayer(newYearsDayLayer)]).toEqual([false, true]);
  });

  it('keeps a layer on the map when renderLayer returns it for the new time', () => {
    const { manager } = setup({ renderLayer: (info, _map, current) => current ?? info.layerData.leafletLayer });
    const leafletLayer = circle();
    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });
    const removed = vi.fn();
    leafletLayer.on('remove', removed);
    const newYearsDay: SingleTimeInfo = { type: 'single', precision: 'date', value: Temporal.PlainDate.from('2026-01-01') };

    manager.setTimeInfo('layer-1', newYearsDay);

    expect(removed).not.toHaveBeenCalled();
  });

  it('passes a removed layer\'s Leaflet layer to disposeLayer', () => {
    const disposeLayer = vi.fn();
    const { manager } = setup({ disposeLayer });
    const leafletLayer = circle();
    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });

    manager.removeLayer('layer-1');

    expect(disposeLayer).toHaveBeenCalledWith(leafletLayer, 'layer-1');
  });

  it('passes the Leaflet layer renderLayer replaces to disposeLayer', () => {
    const disposeLayer = vi.fn();
    const { manager } = setup({ disposeLayer });
    const before = circle();
    manager.addLayer({ ...layerParams('layer-1', before), visible: true });

    manager.updateLayerData('layer-1', { leafletLayer: circle() });

    expect(disposeLayer).toHaveBeenCalledWith(before, 'layer-1');
  });

  it('passes every Leaflet layer to disposeLayer when the adapter is detached', () => {
    const disposeLayer = vi.fn();
    const { manager, detach } = setup({ disposeLayer });
    const first = circle();
    const second = circle();
    manager.addLayer({ ...layerParams('layer-1', first), visible: true });
    manager.addLayer({ ...layerParams('layer-2', second), visible: false });

    detach();

    expect(disposeLayer.mock.calls).toEqual(expect.arrayContaining([[first, 'layer-1'], [second, 'layer-2']]));
    expect(disposeLayer).toHaveBeenCalledTimes(2);
  });

  it('keeps a hidden layer\'s Leaflet layer from disposeLayer, as it comes back when shown', () => {
    const disposeLayer = vi.fn();
    const { manager } = setup({ disposeLayer });
    manager.addLayer({ ...layerParams('layer-1', circle()), visible: true });

    manager.setEnabled('layer-1', false);

    expect(disposeLayer).not.toHaveBeenCalled();
  });

  it('keeps a Leaflet layer from disposeLayer when renderLayer returns it again', () => {
    const disposeLayer = vi.fn();
    const { manager } = setup({ disposeLayer, renderLayer: (info, _map, current) => current ?? info.layerData.leafletLayer });
    manager.addLayer({ ...layerParams('layer-1', circle()), visible: true });

    manager.updateLayerData('layer-1', { leafletLayer: circle() });

    expect(disposeLayer).not.toHaveBeenCalled();
  });

  it('passes the Leaflet layer renderLayer replaces for a new time to disposeLayer', () => {
    const disposeLayer = vi.fn();
    const { manager } = setup({ disposeLayer, renderLayer: (info) => (info.timeInfo ? circle() : info.layerData.leafletLayer) });
    const before = circle();
    manager.addLayer({ ...layerParams('layer-1', before), visible: true });
    const newYearsDay: SingleTimeInfo = { type: 'single', precision: 'date', value: Temporal.PlainDate.from('2026-01-01') };

    manager.setTimeInfo('layer-1', newYearsDay);

    expect(disposeLayer).toHaveBeenCalledWith(before, 'layer-1');
  });

  it('needs renderLayer for layer data that is not a Leaflet layer', () => {
    const { map } = setup();

    // @ts-expect-error The default renderLayer shows only `leafletLayer`, so { url } data needs a renderLayer.
    const adapter = new LeafletLayerManagerAdapter<{ url: string }>(map);

    expect(adapter).toBeInstanceOf(LeafletLayerManagerAdapter);
  });

  it('shows a layer that renderLayer hands to the default', () => {
    const map = setup().map;
    const manager = new LayerManager<{ url: string } | LayerData>();
    manager.setAdapter(new LeafletLayerManagerAdapter<{ url: string } | LayerData>(map, {
      renderLayer: (info) => ('url' in info.layerData ? L.tileLayer(info.layerData.url) : defaultLeafletRenderLayer(info)),
    }));
    const leafletLayer = circle();

    manager.addLayer({ ...layerParams('layer-1', leafletLayer), visible: true });

    expect(map.hasLayer(leafletLayer)).toBe(true);
  });
});
