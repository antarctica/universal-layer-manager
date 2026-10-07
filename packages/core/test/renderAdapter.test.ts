import type { RenderedLayer } from '../src/adapters/renderAdapter';
import type { RenderLayer } from '../src/adapters/types';
import type { LayerConfig, SingleTimeInfo } from '../src/types';
import type { TestLayerData } from './utils/layer-manager-helpers';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it, vi } from 'vitest';
import { RenderAdapter } from '../src/adapters/renderAdapter';
import { LayerManager } from '../src/LayerManager';
import { createTestLayerConfig, createTestLayerGroupConfig } from './utils/layer-manager-helpers';

/** What renderLayer returns for a layer in these tests. */
interface Shape {
  name: string;
}

/** A map that shows shapes. */
interface ShapeMap {
  /** The shape shown for each layer, and how. */
  shapes: Map<string, { shape: Shape; visible: boolean; opacity: number }>;
  /** The layers with a shape, from the bottom up. A shape placed on the map goes on top, as on a real map. */
  stack: string[];
  /** Every shape placed and erased, in order. */
  changes: string[];
}

interface SetupOptions {
  renderLayer?: RenderLayer<TestLayerData, ShapeMap, Shape>;
  disposeLayer?: (shape: Shape, layerId: string) => void;
  isSame?: (previous: Shape, next: Shape) => boolean;
  /** Called as each shape is placed or erased, with the shapes the adapter holds at that moment. */
  onHeld?: (held: string[]) => void;
}

class ShapeAdapter extends RenderAdapter<TestLayerData, undefined, ShapeMap, Shape> {
  private readonly setup: SetupOptions;

  constructor(map: ShapeMap, setup: SetupOptions) {
    super(map, {
      renderLayer: setup.renderLayer ?? ((info) => ({ name: info.layerData.test })),
      disposeLayer: setup.disposeLayer,
    });
    this.setup = setup;
  }

  /** Puts every shape back on the map, as after the map lost them. */
  reload(): void {
    this.map.shapes.clear();
    this.placeAll();
  }

  protected placeLayer({ layerId, rendered, visible, computedOpacity }: RenderedLayer<Shape>, previous?: Shape): void {
    this.map.changes.push(`place ${rendered.name}${previous ? ` over ${previous.name}` : ''}`);
    this.map.shapes.set(layerId, { shape: rendered, visible, opacity: computedOpacity });
    this.map.stack = [...this.map.stack.filter((id) => id !== layerId), layerId];
    this.setup.onHeld?.(this.renderedLayers().map((layer) => layer.rendered.name));
  }

  protected eraseLayer(layerId: string, rendered: Shape, next?: Shape): void {
    this.map.changes.push(`erase ${rendered.name}${next ? ` for ${next.name}` : ''}`);
    this.map.shapes.delete(layerId);
    this.map.stack = this.map.stack.filter((id) => id !== layerId);
    this.setup.onHeld?.(this.renderedLayers().map((layer) => layer.rendered.name));
  }

  protected setLayerVisible({ layerId, visible }: RenderedLayer<Shape>): void {
    const shown = this.map.shapes.get(layerId);
    if (shown) {
      shown.visible = visible;
    }
  }

  protected setLayerOpacity({ layerId, computedOpacity }: RenderedLayer<Shape>): void {
    const shown = this.map.shapes.get(layerId);
    if (shown) {
      shown.opacity = computedOpacity;
    }
  }

  protected restackLayers(bottomToTop: RenderedLayer<Shape>[]): void {
    this.map.changes.push('restack');
    this.map.stack = bottomToTop.map((layer) => layer.layerId);
  }

  protected override isSame(previous: Shape, next: Shape): boolean {
    return this.setup.isSame?.(previous, next) ?? false;
  }
}

function setup(options: SetupOptions = {}) {
  const map: ShapeMap = { shapes: new Map(), stack: [], changes: [] };
  const manager = new LayerManager<TestLayerData>({ allowNestedGroupLayers: true });
  const adapter = new ShapeAdapter(map, options);
  manager.setAdapter(adapter);
  return { manager, map, adapter };
}

function layer(layerId: string, test = layerId, overrides: Partial<LayerConfig<TestLayerData>> = {}) {
  return { layerConfig: createTestLayerConfig({ layerId, layerData: { test }, ...overrides }) };
}

function group(layerId: string) {
  return { layerConfig: createTestLayerGroupConfig({ layerId }) };
}

/** Returns null for a layer whose data is 'none'. */
const skipNone: RenderLayer<TestLayerData, ShapeMap, Shape> = (info) => (info.layerData.test === 'none' ? null : { name: info.layerData.test });

describe('renderAdapter', () => {
  describe('renderLayer', () => {
    it('puts what renderLayer returns for a layer on the map when the layer is added', () => {
      const { manager, map } = setup();

      manager.addLayer(layer('rivers', 'blue line'));

      expect(map.shapes.get('rivers')?.shape).toEqual({ name: 'blue line' });
    });

    it('leaves a layer off the map when renderLayer returns null for it', () => {
      const { manager, map } = setup({ renderLayer: () => null });

      manager.addLayer(layer('rivers'));

      expect(map.shapes.has('rivers')).toBe(false);
    });

    it('never calls renderLayer for a group', () => {
      const renderLayer = vi.fn(() => null);
      const { manager } = setup({ renderLayer });

      manager.addGroup(group('water'));

      expect(renderLayer).not.toHaveBeenCalled();
    });

    it('puts what renderLayer returns for a layer\'s new data on the map in place of the old', () => {
      const { manager, map } = setup();
      manager.addLayer(layer('rivers', 'blue line'));

      manager.updateLayerData('rivers', { test: 'red line' });

      expect(map.shapes.get('rivers')?.shape).toEqual({ name: 'red line' });
    });

    it('passes what renderLayer returned for a layer last time to it as current when the layer\'s data changes', () => {
      const renderLayer = vi.fn<RenderLayer<TestLayerData, ShapeMap, Shape>>((info) => ({ name: info.layerData.test }));
      const { manager } = setup({ renderLayer });
      manager.addLayer(layer('rivers', 'blue line'));

      manager.updateLayerData('rivers', { test: 'red line' });

      expect(renderLayer).toHaveBeenLastCalledWith(expect.objectContaining({ layerId: 'rivers' }), expect.anything(), { name: 'blue line' });
    });

    it('leaves the map alone when renderLayer returns current for a layer\'s new data', () => {
      const { manager, map } = setup({ renderLayer: (info, _map, current) => current ?? { name: info.layerData.test } });
      manager.addLayer(layer('rivers'));
      map.changes.length = 0;

      manager.updateLayerData('rivers', { test: 'red line' });

      expect(map.changes).toEqual([]);
    });

    it('takes a layer off the map when renderLayer returns null for its new data', () => {
      const { manager, map } = setup({ renderLayer: skipNone });
      manager.addLayer(layer('rivers', 'blue line'));

      manager.updateLayerData('rivers', { test: 'none' });

      expect(map.shapes.has('rivers')).toBe(false);
    });

    it('puts a layer renderLayer left off the map on it once renderLayer returns a shape for its new data', () => {
      const { manager, map } = setup({ renderLayer: skipNone });
      manager.addLayer(layer('rivers', 'none'));

      manager.updateLayerData('rivers', { test: 'blue line' });

      expect(map.shapes.get('rivers')?.shape).toEqual({ name: 'blue line' });
    });

    it('puts what renderLayer returns for a layer\'s new time on the map in place of the old', () => {
      const { manager, map } = setup({ renderLayer: (info) => ({ name: info.timeInfo ? 'dated' : info.layerData.test }) });
      manager.addLayer(layer('rivers', 'blue line'));
      const newYearsDay: SingleTimeInfo = { type: 'single', precision: 'date', value: Temporal.PlainDate.from('2026-01-01') };

      manager.setTimeInfo('rivers', newYearsDay);

      expect(map.shapes.get('rivers')?.shape).toEqual({ name: 'dated' });
    });

    it('tells the adapter which shape replaces which, so it can update the map in place', () => {
      const { manager, map } = setup();
      manager.addLayer(layer('rivers', 'blue line'));
      map.changes.length = 0;

      manager.updateLayerData('rivers', { test: 'red line' });

      expect(map.changes.filter((change) => change !== 'restack')).toEqual(['erase blue line for red line', 'place red line over blue line']);
    });

    it('holds a layer\'s new shape, and not its old one, while it erases the old and places the new', () => {
      const held: string[][] = [];
      const { manager } = setup({ onHeld: (names) => held.push(names) });
      manager.addLayer(layer('lakes', 'blue fill'));
      manager.addLayer(layer('rivers', 'blue line'));
      held.length = 0;

      manager.updateLayerData('rivers', { test: 'red line' });

      expect(held).toEqual([['blue fill'], ['blue fill', 'red line']]);
    });
  });

  describe('visibility and opacity', () => {
    it('shows a layer\'s shape while the layer is visible, and hides it when the layer is hidden', () => {
      const { manager, map } = setup();
      manager.addLayer({ ...layer('rivers'), visible: true });
      expect(map.shapes.get('rivers')?.visible).toBe(true);

      manager.setEnabled('rivers', false);

      expect(map.shapes.get('rivers')?.visible).toBe(false);
    });

    it('fades a layer\'s shape to its opacity combined with its group\'s', () => {
      const { manager, map } = setup();
      manager.addGroup(group('water'));
      manager.addLayer(layer('rivers', 'rivers', { parentId: 'water' }));

      manager.setOpacity('water', 0.5);
      manager.setOpacity('rivers', 0.5);

      expect(map.shapes.get('rivers')?.opacity).toBe(0.25);
    });

    it('places a layer renderLayer skipped at the visibility and opacity it was given while skipped', () => {
      const { manager, map } = setup({ renderLayer: skipNone });
      manager.addLayer(layer('rivers', 'none'));
      manager.setEnabled('rivers', true);
      manager.setOpacity('rivers', 0.5);

      manager.updateLayerData('rivers', { test: 'blue line' });

      expect(map.shapes.get('rivers')).toEqual({ shape: { name: 'blue line' }, visible: true, opacity: 0.5 });
    });
  });

  describe('order', () => {
    it('stacks the layers with a shape in the manager\'s order, from the bottom up', () => {
      const { manager, map } = setup({ renderLayer: skipNone });
      manager.addGroup({ ...group('water'), position: 'top' });
      manager.addLayer({ ...layer('lakes', 'lakes', { parentId: 'water' }), position: 'top' });
      manager.addLayer({ ...layer('rivers', 'rivers', { parentId: 'water' }), position: 'top' });
      manager.addLayer({ ...layer('labels', 'none'), position: 'top' });
      manager.addLayer({ ...layer('roads', 'roads'), position: 'bottom' });

      manager.raiseLayer('roads');

      expect(map.stack).toEqual(['lakes', 'rivers', 'roads']);
    });

    it('puts a layer\'s new shape back in the layer\'s place in the stack', () => {
      const { manager, map } = setup();
      manager.addLayer({ ...layer('rivers', 'blue line'), position: 'bottom' });
      manager.addLayer({ ...layer('lakes', 'blue fill'), position: 'top' });

      manager.updateLayerData('rivers', { test: 'red line' });

      expect(map.stack).toEqual(['rivers', 'lakes']);
    });

    it('stacks a layer renderLayer left off the map in its place once it has a shape', () => {
      const { manager, map } = setup({ renderLayer: skipNone });
      manager.addLayer({ ...layer('rivers', 'none'), position: 'bottom' });
      manager.addLayer({ ...layer('lakes', 'blue fill'), position: 'top' });

      manager.updateLayerData('rivers', { test: 'blue line' });

      expect(map.stack).toEqual(['rivers', 'lakes']);
    });

    it('leaves the stack alone when the adapter counts a layer\'s new shape as the same', () => {
      const { manager, map } = setup({ isSame: () => true });
      manager.addLayer(layer('rivers', 'blue line'));
      map.changes.length = 0;

      manager.updateLayerData('rivers', { test: 'red line' });

      expect(map.changes).not.toContain('restack');
    });
  });

  describe('placeAll', () => {
    it('puts every layer with a shape back on the map, shown, faded and stacked as before', () => {
      const { manager, map, adapter } = setup({ renderLayer: skipNone });
      manager.addLayer({ ...layer('rivers', 'blue line'), visible: true, position: 'bottom' });
      manager.addLayer({ ...layer('lakes', 'blue fill'), position: 'top' });
      manager.addLayer({ ...layer('labels', 'none'), position: 'top' });
      manager.setOpacity('lakes', 0.5);

      adapter.reload();

      expect([...map.shapes]).toEqual([
        ['rivers', { shape: { name: 'blue line' }, visible: true, opacity: 1 }],
        ['lakes', { shape: { name: 'blue fill' }, visible: false, opacity: 0.5 }],
      ]);
      expect(map.stack).toEqual(['rivers', 'lakes']);
    });
  });

  describe('disposeLayer', () => {
    it('passes a removed layer\'s shape to disposeLayer', () => {
      const disposeLayer = vi.fn();
      const { manager } = setup({ disposeLayer });
      manager.addLayer(layer('rivers', 'blue line'));

      manager.removeLayer('rivers');

      expect(disposeLayer).toHaveBeenCalledExactlyOnceWith({ name: 'blue line' }, 'rivers');
    });

    it('passes the shape renderLayer replaces to disposeLayer', () => {
      const disposeLayer = vi.fn();
      const { manager } = setup({ disposeLayer });
      manager.addLayer(layer('rivers', 'blue line'));

      manager.updateLayerData('rivers', { test: 'red line' });

      expect(disposeLayer).toHaveBeenCalledExactlyOnceWith({ name: 'blue line' }, 'rivers');
    });

    it('passes a layer\'s shape to disposeLayer when renderLayer returns null for its new data', () => {
      const disposeLayer = vi.fn();
      const { manager } = setup({ disposeLayer, renderLayer: skipNone });
      manager.addLayer(layer('rivers', 'blue line'));

      manager.updateLayerData('rivers', { test: 'none' });

      expect(disposeLayer).toHaveBeenCalledExactlyOnceWith({ name: 'blue line' }, 'rivers');
    });

    it('keeps a shape from disposeLayer when the adapter counts the shape that replaces it as the same', () => {
      const disposeLayer = vi.fn();
      const { manager, map } = setup({ disposeLayer, isSame: (previous, next) => previous.name.endsWith('line') && next.name.endsWith('line') });
      manager.addLayer(layer('rivers', 'blue line'));

      manager.updateLayerData('rivers', { test: 'red line' });

      expect(map.shapes.get('rivers')?.shape).toEqual({ name: 'red line' });
      expect(disposeLayer).not.toHaveBeenCalled();
    });
  });

  describe('detaching', () => {
    it('takes every layer off the map, and passes each shape to disposeLayer, when the adapter is detached', () => {
      const disposeLayer = vi.fn();
      const { manager, map } = setup({ disposeLayer });
      manager.addLayer(layer('rivers', 'blue line'));
      manager.addLayer(layer('lakes', 'blue fill'));

      manager.setAdapter(null);

      expect(map.shapes.size).toBe(0);
      expect(disposeLayer).toHaveBeenCalledTimes(2);
      expect(disposeLayer).toHaveBeenCalledWith({ name: 'blue line' }, 'rivers');
      expect(disposeLayer).toHaveBeenCalledWith({ name: 'blue fill' }, 'lakes');
    });

    it('takes a layer off the map when it is removed', () => {
      const { manager, map } = setup();
      manager.addLayer(layer('rivers'));

      manager.removeLayer('rivers');

      expect(map.shapes.has('rivers')).toBe(false);
    });
  });
});
