import type { RenderLayer } from '../src/adapters/types';
import type { LayerConfig } from '../src/types';
import type { TestLayerData } from './utils/layer-manager-helpers';
import { describe, expect, it, vi } from 'vitest';
import { RenderedLayers } from '../src/adapters/renderedLayers';
import { LayerManager } from '../src/LayerManager';
import { createTestLayerConfig, createTestLayerGroupConfig } from './utils/layer-manager-helpers';

/** What renderLayer returns for a layer in these tests. */
interface Shape {
  name: string;
}

/** A map that keeps the shape it shows for each layer. */
type ShapeMap = Map<string, Shape>;

interface SetupOptions {
  renderLayer?: RenderLayer<TestLayerData, ShapeMap, Shape>;
  disposeLayer?: (shape: Shape, layerId: string) => void;
  isSame?: (previous: Shape, next: Shape) => boolean;
}

function setup(options: SetupOptions = {}) {
  const map: ShapeMap = new Map();
  // Every change made to the map, in order.
  const changes: string[] = [];
  const manager = new LayerManager<TestLayerData>();
  const layers = new RenderedLayers<TestLayerData, ShapeMap, Shape>({
    map,
    renderLayer: options.renderLayer ?? ((info) => ({ name: info.layerData.test })),
    disposeLayer: options.disposeLayer,
    isSame: options.isSame,
    place: (info, shape) => {
      changes.push(`place ${info.layerId}`);
      map.set(info.layerId, shape);
    },
    erase: (layerId) => {
      changes.push(`erase ${layerId}`);
      map.delete(layerId);
    },
  });
  manager.setAdapter({
    onLayerAdded: (info) => layers.add(info),
    onLayerRemoved: (layerId) => layers.remove(layerId),
    onLayerDataChanged: (info) => layers.update(info),
    unregister: () => layers.clear(),
  });
  return { manager, map, changes, layers };
}

function layer(layerId: string, overrides: Partial<LayerConfig<TestLayerData>> = {}) {
  return { layerConfig: createTestLayerConfig({ layerId, ...overrides }) };
}

function group(layerId: string) {
  return { layerConfig: createTestLayerGroupConfig({ layerId }) };
}

describe('renderedLayers', () => {
  it('puts what renderLayer returns for a layer on the map when the layer is added', () => {
    const { manager, map } = setup();

    manager.addLayer(layer('rivers', { layerData: { test: 'blue line' } }));

    expect(map.get('rivers')).toEqual({ name: 'blue line' });
  });

  it('leaves a layer off the map when renderLayer returns null for it', () => {
    const { manager, map } = setup({ renderLayer: () => null });

    manager.addLayer(layer('rivers'));

    expect(map.has('rivers')).toBe(false);
  });

  it('never calls renderLayer for a group', () => {
    const renderLayer = vi.fn(() => null);
    const { manager } = setup({ renderLayer });

    manager.addGroup(group('water'));

    expect(renderLayer).not.toHaveBeenCalled();
  });

  it('puts what renderLayer returns for a layer\'s new data on the map in place of the old', () => {
    const { manager, map } = setup();
    manager.addLayer(layer('rivers', { layerData: { test: 'blue line' } }));

    manager.updateLayerData('rivers', { test: 'red line' });

    expect(map.get('rivers')).toEqual({ name: 'red line' });
  });

  it('passes what renderLayer returned for a layer last time to it as current when the layer\'s data changes', () => {
    const renderLayer = vi.fn<RenderLayer<TestLayerData, ShapeMap, Shape>>((info) => ({ name: info.layerData.test }));
    const { manager } = setup({ renderLayer });
    manager.addLayer(layer('rivers', { layerData: { test: 'blue line' } }));

    manager.updateLayerData('rivers', { test: 'red line' });

    expect(renderLayer).toHaveBeenLastCalledWith(expect.objectContaining({ layerId: 'rivers' }), expect.anything(), { name: 'blue line' });
  });

  it('leaves the map alone when renderLayer returns current for a layer\'s new data', () => {
    const { manager, changes } = setup({ renderLayer: (info, _map, current) => current ?? { name: info.layerData.test } });
    manager.addLayer(layer('rivers'));
    changes.length = 0;

    manager.updateLayerData('rivers', { test: 'red line' });

    expect(changes).toEqual([]);
  });

  it('takes a layer off the map when it is removed', () => {
    const { manager, map } = setup();
    manager.addLayer(layer('rivers'));

    manager.removeLayer('rivers');

    expect(map.has('rivers')).toBe(false);
  });

  it('takes a layer off the map, and passes its shape to disposeLayer, when renderLayer returns null for its new data', () => {
    const disposeLayer = vi.fn();
    const { manager, map } = setup({ disposeLayer, renderLayer: (info) => (info.layerData.test === 'none' ? null : { name: info.layerData.test }) });
    manager.addLayer(layer('rivers', { layerData: { test: 'blue line' } }));

    manager.updateLayerData('rivers', { test: 'none' });

    expect(map.has('rivers')).toBe(false);
    expect(disposeLayer).toHaveBeenCalledExactlyOnceWith({ name: 'blue line' }, 'rivers');
  });

  it('puts a layer renderLayer left off the map on it once renderLayer returns a shape for its new data', () => {
    const { manager, map } = setup({ renderLayer: (info) => (info.layerData.test === 'none' ? null : { name: info.layerData.test }) });
    manager.addLayer(layer('rivers', { layerData: { test: 'none' } }));

    manager.updateLayerData('rivers', { test: 'blue line' });

    expect(map.get('rivers')).toEqual({ name: 'blue line' });
  });

  it('passes a removed layer\'s shape to disposeLayer', () => {
    const disposeLayer = vi.fn();
    const { manager } = setup({ disposeLayer });
    manager.addLayer(layer('rivers', { layerData: { test: 'blue line' } }));

    manager.removeLayer('rivers');

    expect(disposeLayer).toHaveBeenCalledExactlyOnceWith({ name: 'blue line' }, 'rivers');
  });

  it('passes the shape renderLayer replaces to disposeLayer', () => {
    const disposeLayer = vi.fn();
    const { manager } = setup({ disposeLayer });
    manager.addLayer(layer('rivers', { layerData: { test: 'blue line' } }));

    manager.updateLayerData('rivers', { test: 'red line' });

    expect(disposeLayer).toHaveBeenCalledExactlyOnceWith({ name: 'blue line' }, 'rivers');
  });

  it('takes every layer off the map, and passes each shape to disposeLayer, when the adapter is detached', () => {
    const disposeLayer = vi.fn();
    const { manager, map } = setup({ disposeLayer });
    manager.addLayer(layer('rivers', { layerData: { test: 'blue line' } }));
    manager.addLayer(layer('lakes', { layerData: { test: 'blue fill' } }));

    manager.setAdapter(null);

    expect(map.size).toBe(0);
    expect(disposeLayer).toHaveBeenCalledTimes(2);
    expect(disposeLayer).toHaveBeenCalledWith({ name: 'blue line' }, 'rivers');
    expect(disposeLayer).toHaveBeenCalledWith({ name: 'blue fill' }, 'lakes');
  });

  it('keeps a shape from disposeLayer when the adapter counts the shape that replaces it as the same', () => {
    const disposeLayer = vi.fn();
    const { manager, map } = setup({ disposeLayer, isSame: (previous, next) => previous.name.endsWith('line') && next.name.endsWith('line') });
    manager.addLayer(layer('rivers', { layerData: { test: 'blue line' } }));

    manager.updateLayerData('rivers', { test: 'red line' });

    expect(map.get('rivers')).toEqual({ name: 'red line' });
    expect(disposeLayer).not.toHaveBeenCalled();
  });

  it('gives the adapter what renderLayer last returned for a layer', () => {
    const { manager, layers } = setup();
    manager.addLayer(layer('rivers', { layerData: { test: 'blue line' } }));

    manager.updateLayerData('rivers', { test: 'red line' });

    expect(layers.get('rivers')).toEqual({ name: 'red line' });
  });

  it('gives the adapter nothing for a layer renderLayer left off the map', () => {
    const { manager, layers } = setup({ renderLayer: () => null });

    manager.addLayer(layer('rivers'));

    expect(layers.get('rivers')).toBeUndefined();
  });
});
