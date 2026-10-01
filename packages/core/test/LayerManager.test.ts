import type { LayerManagerAdapter, LayerManagerCallbacks } from '../src/adapters/types';
import type { LayerManagerOptions } from '../src/LayerManager';
import type { LayerConfig, SingleTimeInfo } from '../src/types';
import type { TestLayerData } from './utils/layer-manager-helpers';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it, vi } from 'vitest';
import { LayerManager } from '../src/LayerManager';
import { createTestLayerConfig, createTestLayerGroupConfig } from './utils/layer-manager-helpers';
import { createMapModel } from './utils/map-model';

type TestManager = LayerManager<TestLayerData, TestLayerData>;

function createManager(options: LayerManagerOptions<TestLayerData, TestLayerData> = {}) {
  const manager: TestManager = new LayerManager<TestLayerData, TestLayerData>(options);
  const map = createMapModel<TestLayerData>();
  manager.setAdapter(map);
  return { manager, map };
}

function layer(layerId: string, overrides: Partial<LayerConfig<TestLayerData>> = {}) {
  return { layerConfig: createTestLayerConfig({ layerId, ...overrides }) };
}

function group(layerId: string, parentId: string | null = null) {
  return { layerConfig: createTestLayerGroupConfig<TestLayerData>({ layerId, parentId }) };
}

function topLevelIds(manager: TestManager): string[] {
  return manager.layers.map((item) => item.layerActor.id);
}

function childIdsOf(manager: TestManager, groupId: string): string[] {
  const item = manager.getLayer(groupId);
  return item?.type === 'layerGroup' ? item.layerActor.getSnapshot().context.childLayerOrder : [];
}

const newYearsDay: SingleTimeInfo = { type: 'single', precision: 'date', value: Temporal.ZonedDateTime.from('2024-01-01T00:00[UTC]') };

describe('layerManager', () => {
  describe('layer order', () => {
    it('adds new top-level layers at the bottom by default', () => {
      const { manager } = createManager();

      manager.addLayer(layer('a'));
      manager.addLayer(layer('b'));
      manager.addLayer(layer('c'));

      expect(topLevelIds(manager)).toEqual(['c', 'b', 'a']);
    });

    it('adds a top-level layer at the top or at an index when asked', () => {
      const { manager } = createManager();
      manager.addLayer(layer('a'));
      manager.addLayer(layer('b'));

      manager.addLayer({ ...layer('top'), position: 'top' });
      manager.addLayer({ ...layer('middle'), index: 1 });

      expect(topLevelIds(manager)).toEqual(['b', 'middle', 'a', 'top']);
    });

    it('lists a group\'s children in the order they were placed', () => {
      const { manager } = createManager();
      manager.addGroup(group('group-1'));

      manager.addLayer(layer('c1', { parentId: 'group-1' }));
      manager.addLayer(layer('c2', { parentId: 'group-1' }));
      manager.addLayer({ ...layer('c3', { parentId: 'group-1' }), position: 'top' });
      manager.addLayer({ ...layer('cm', { parentId: 'group-1' }), index: 1 });

      expect(childIdsOf(manager, 'group-1')).toEqual(['c2', 'cm', 'c1', 'c3']);
      expect(topLevelIds(manager)).toEqual(['group-1']);
    });

    it('reports the whole layer order, bottom first, each time it changes', () => {
      const onOrderChanged = vi.fn();
      const { manager, map } = createManager({ onOrderChanged });

      manager.addGroup(group('group-1'));
      manager.addLayer(layer('layer-1'));
      manager.addLayer(layer('child-1', { parentId: 'group-1' }));
      manager.removeLayer('layer-1');

      expect(onOrderChanged.mock.calls.map(([layerOrder]) => layerOrder)).toEqual([
        ['group-1'],
        ['layer-1', 'group-1'],
        ['layer-1', 'group-1', 'child-1'],
        ['group-1', 'child-1'],
      ]);
      expect(map.order).toEqual(['group-1', 'child-1']);
    });

    it('reports an empty layer order after a reset', () => {
      const { manager, map } = createManager();
      manager.addLayer(layer('layer-1'));

      manager.reset();

      expect(map.order).toEqual([]);
    });

    it('gives a group its child actors in display order', () => {
      const { manager } = createManager();
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('c1', { parentId: 'group-1' }));
      manager.addLayer({ ...layer('c2', { parentId: 'group-1' }), position: 'top' });

      const item = manager.getLayer('group-1');
      const children = item?.type === 'layerGroup' ? item.layerActor.getSnapshot().context.children : [];

      expect(children.map((child) => child.id)).toEqual(['c1', 'c2']);
    });
  });

  describe('moving layers', () => {
    function managerWithTopLevel(...layerIds: string[]) {
      const created = createManager();
      layerIds.forEach((layerId) => created.manager.addLayer({ ...layer(layerId), position: 'top' }));
      return created;
    }

    it('moves a top-level layer up to an index', () => {
      const { manager, map } = managerWithTopLevel('a', 'b', 'c');

      manager.moveLayer('a', { parentId: null, index: 2 });

      expect(topLevelIds(manager)).toEqual(['b', 'c', 'a']);
      expect(map.order).toEqual(['b', 'c', 'a']);
    });

    it('moves a layer down to an index within its group', () => {
      const { manager, map } = createManager();
      manager.addGroup(group('group-1'));
      ['c1', 'c2', 'c3'].forEach((layerId) => manager.addLayer({ ...layer(layerId, { parentId: 'group-1' }), position: 'top' }));

      manager.moveLayer('c3', { parentId: 'group-1', index: 0 });

      expect(childIdsOf(manager, 'group-1')).toEqual(['c3', 'c1', 'c2']);
      expect(map.order).toEqual(['group-1', 'c3', 'c1', 'c2']);
    });

    it('moves a layer to the top or the bottom of its parent, and to the bottom by default', () => {
      const { manager } = managerWithTopLevel('a', 'b', 'c', 'd');

      manager.moveLayer('a', { parentId: null, position: 'top' });
      expect(topLevelIds(manager)).toEqual(['b', 'c', 'd', 'a']);

      manager.moveLayer('d', { parentId: null, position: 'bottom' });
      expect(topLevelIds(manager)).toEqual(['d', 'b', 'c', 'a']);

      manager.moveLayer('c', { parentId: null });
      expect(topLevelIds(manager)).toEqual(['c', 'd', 'b', 'a']);
    });

    it('raises a layer one step towards the top of its parent', () => {
      const { manager } = managerWithTopLevel('a', 'b', 'c');

      manager.raiseLayer('a');

      expect(topLevelIds(manager)).toEqual(['b', 'a', 'c']);
    });

    it('lowers a layer one step towards the bottom of its group', () => {
      const { manager } = createManager();
      manager.addGroup(group('group-1'));
      ['c1', 'c2', 'c3'].forEach((layerId) => manager.addLayer({ ...layer(layerId, { parentId: 'group-1' }), position: 'top' }));

      manager.lowerLayer('c3');

      expect(childIdsOf(manager, 'group-1')).toEqual(['c1', 'c3', 'c2']);
    });

    it('moves a layer from one group into another', () => {
      const onLayerMoved = vi.fn();
      const { manager, map } = createManager({ onLayerMoved });
      manager.addGroup({ ...group('group-1'), position: 'top' });
      manager.addGroup({ ...group('group-2'), position: 'top' });
      manager.addLayer(layer('c1', { parentId: 'group-1' }));
      manager.addLayer(layer('c2', { parentId: 'group-2' }));

      manager.moveLayer('c1', { parentId: 'group-2', position: 'top' });

      expect(childIdsOf(manager, 'group-1')).toEqual([]);
      expect(childIdsOf(manager, 'group-2')).toEqual(['c2', 'c1']);
      expect(map.order).toEqual(['group-1', 'group-2', 'c2', 'c1']);
      expect(map.layers.get('c1')?.parentId).toBe('group-2');
      expect(onLayerMoved).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'c1', parentId: 'group-2' }));
    });

    it('moves a layer out of its group to the top level', () => {
      const { manager, map } = createManager();
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('c1', { parentId: 'group-1' }));

      manager.moveLayer('c1', { parentId: null, position: 'top' });

      expect(childIdsOf(manager, 'group-1')).toEqual([]);
      expect(topLevelIds(manager)).toEqual(['group-1', 'c1']);
      expect(map.order).toEqual(['group-1', 'c1']);
      expect(map.layers.get('c1')?.parentId).toBeNull();
    });

    it('moves a top-level layer into a group', () => {
      const { manager, map } = createManager();
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('c1', { parentId: 'group-1' }));
      manager.addLayer(layer('layer-1'));

      manager.moveLayer('layer-1', { parentId: 'group-1', index: 0 });

      expect(topLevelIds(manager)).toEqual(['group-1']);
      expect(childIdsOf(manager, 'group-1')).toEqual(['layer-1', 'c1']);
      expect(map.order).toEqual(['group-1', 'layer-1', 'c1']);
      expect(map.layers.get('layer-1')?.parentId).toBe('group-1');
    });

    it('combines a moved layer\'s opacity with its new group\'s opacity', () => {
      const { manager, map } = createManager();
      manager.addGroup({ layerConfig: createTestLayerGroupConfig<TestLayerData>({ layerId: 'group-1', opacity: 0.5 }) });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig<TestLayerData>({ layerId: 'group-2', opacity: 0.25 }) });
      manager.addLayer(layer('c1', { parentId: 'group-1', opacity: 0.8 }));

      manager.moveLayer('c1', { parentId: 'group-2' });

      expect(map.layers.get('c1')).toMatchObject({ opacity: 0.8, computedOpacity: 0.2 });
    });

    it('updates the computed opacity of a moved group\'s layers', () => {
      const { manager, map } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig<TestLayerData>({ layerId: 'group-1', opacity: 0.5 }) });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig<TestLayerData>({ layerId: 'group-2', opacity: 0.25 }) });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig<TestLayerData>({ layerId: 'inner', parentId: 'group-1', opacity: 0.8 }) });
      manager.addLayer(layer('c1', { parentId: 'inner', opacity: 0.5 }));

      manager.moveLayer('inner', { parentId: 'group-2' });

      expect(map.layers.get('inner')).toMatchObject({ opacity: 0.8, computedOpacity: 0.2 });
      expect(map.layers.get('c1')).toMatchObject({ opacity: 0.5, computedOpacity: 0.1 });
    });

    it('reports opacity after a move only when the computed opacity changes', () => {
      const onOpacityChanged = vi.fn();
      const { manager } = createManager({ onOpacityChanged });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig<TestLayerData>({ layerId: 'group-1', opacity: 0.5 }) });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig<TestLayerData>({ layerId: 'group-2', opacity: 0.5 }) });
      manager.addLayer(layer('c1', { parentId: 'group-1' }));

      manager.moveLayer('c1', { parentId: 'group-2' });

      expect(onOpacityChanged).not.toHaveBeenCalled();
    });

    it('hides a switched-on layer moved into a group that is not showing, and keeps it switched on', () => {
      const { manager, map } = createManager();
      manager.addGroup({ ...group('showing'), visible: true });
      manager.addGroup(group('switched-off'));
      manager.addLayer({ ...layer('c1', { parentId: 'showing' }), visible: true });

      manager.moveLayer('c1', { parentId: 'switched-off' });

      expect(map.layers.get('c1')).toMatchObject({ enabled: true, visible: false });
      expect(map.layers.get('switched-off')).toMatchObject({ enabled: false, visible: false });
    });

    it('shows a switched-on layer moved into a group that is showing', () => {
      const { manager, map } = createManager();
      manager.addGroup(group('switched-off'));
      manager.addGroup({ ...group('showing'), visible: true });
      manager.addLayer({ ...layer('c1', { parentId: 'switched-off' }), enabled: true });

      manager.moveLayer('c1', { parentId: 'showing' });

      expect(map.layers.get('c1')).toMatchObject({ enabled: true, visible: true });
    });

    it('keeps a switched-off layer switched off when it moves into a group that is showing', () => {
      const { manager, map } = createManager();
      manager.addGroup(group('switched-off'));
      manager.addGroup({ ...group('showing'), visible: true });
      manager.addLayer(layer('c1', { parentId: 'switched-off' }));

      manager.moveLayer('c1', { parentId: 'showing' });

      expect(map.layers.get('c1')).toMatchObject({ enabled: false, visible: false });
    });

    it('hides a switched-on group and its layers when the group moves into a group that is not showing', () => {
      const { manager, map } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup({ ...group('showing'), visible: true });
      manager.addGroup(group('switched-off'));
      manager.addGroup({ ...group('inner', 'showing'), visible: true });
      manager.addLayer({ ...layer('c1', { parentId: 'inner' }), visible: true });

      manager.moveLayer('inner', { parentId: 'switched-off' });

      expect(map.layers.get('inner')).toMatchObject({ parentId: 'switched-off', enabled: true, visible: false });
      expect(map.layers.get('c1')).toMatchObject({ enabled: true, visible: false });
    });

    it('shows a switched-on group and its switched-on layers when the group moves into a group that is showing', () => {
      const { manager, map } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup(group('switched-off'));
      manager.addGroup({ ...group('showing'), visible: true });
      manager.addGroup({ ...group('inner', 'switched-off'), enabled: true });
      manager.addLayer({ ...layer('on', { parentId: 'inner' }), enabled: true });
      manager.addLayer(layer('off', { parentId: 'inner' }));

      manager.moveLayer('inner', { parentId: 'showing' });

      expect(map.visibleLayerIds()).toEqual(['inner', 'on', 'showing']);
      expect(map.layers.get('off')).toMatchObject({ enabled: false, visible: false });
    });

    it('keeps a switched-off group switched off when it moves into a group that is showing', () => {
      const { manager, map } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup(group('switched-off'));
      manager.addGroup({ ...group('showing'), visible: true });
      manager.addGroup(group('inner', 'switched-off'));

      manager.moveLayer('inner', { parentId: 'showing' });

      expect(map.layers.get('inner')).toMatchObject({ parentId: 'showing', enabled: false, visible: false });
    });

    it('switches on the new groups above a moved layer when it is switched on, and not the old group', () => {
      const { manager, map } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup(group('old'));
      manager.addGroup(group('outer'));
      manager.addGroup(group('inner', 'outer'));
      manager.addLayer(layer('c1', { parentId: 'old' }));
      manager.moveLayer('c1', { parentId: 'inner' });

      manager.setEnabled('c1', true);

      expect(map.visibleLayerIds()).toEqual(['c1', 'inner', 'outer']);
      expect(map.layers.get('old')).toMatchObject({ enabled: false });
    });

    it('reports a moved layer with its parent to onLayerMoved and the adapter', () => {
      const onLayerMoved = vi.fn();
      const adapterOnLayerMoved = vi.fn();
      const manager: TestManager = new LayerManager<TestLayerData, TestLayerData>({ onLayerMoved });
      manager.setAdapter({ onLayerMoved: adapterOnLayerMoved });
      manager.addGroup(group('group-1'));
      manager.addLayer({ ...layer('c1', { parentId: 'group-1' }), position: 'top' });
      manager.addLayer({ ...layer('c2', { parentId: 'group-1' }), position: 'top' });

      manager.raiseLayer('c1');

      expect(onLayerMoved).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'c1', parentId: 'group-1' }));
      expect(adapterOnLayerMoved).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'c1', parentId: 'group-1' }));
    });

    it('leaves the order alone when raising the top layer or lowering the bottom layer', () => {
      const onOrderChanged = vi.fn();
      const { manager } = createManager({ onOrderChanged });
      ['a', 'b', 'c'].forEach((layerId) => manager.addLayer({ ...layer(layerId), position: 'top' }));
      onOrderChanged.mockClear();

      manager.raiseLayer('c');
      manager.lowerLayer('a');

      expect(topLevelIds(manager)).toEqual(['a', 'b', 'c']);
      expect(onOrderChanged).not.toHaveBeenCalled();
    });
  });

  describe('adding layers', () => {
    it('reports each added layer with its configuration', () => {
      const { manager, map } = createManager();
      manager.addGroup({ layerConfig: createTestLayerGroupConfig<TestLayerData>({ layerId: 'group-1', opacity: 0.5 }) });

      manager.addLayer(layer('layer-1', {
        parentId: 'group-1',
        layerName: 'Sea ice',
        layerData: { test: 'sea-ice' },
        opacity: 0.8,
        timeInfo: newYearsDay,
      }));

      expect(map.layers.get('layer-1')).toEqual({
        layerName: 'Sea ice',
        layerType: 'layer',
        listMode: 'show',
        parentId: 'group-1',
        enabled: false,
        visible: false,
        opacity: 0.8,
        computedOpacity: 0.4,
        timeInfo: newYearsDay,
        layerData: { test: 'sea-ice' },
      });
    });

    it('adds a layer switched off and hidden by default', () => {
      const { manager, map } = createManager();

      manager.addLayer(layer('layer-1'));

      expect(map.layers.get('layer-1')).toMatchObject({ enabled: false, visible: false });
    });

    it('shows an enabled top-level layer', () => {
      const { manager, map } = createManager();

      manager.addLayer({ ...layer('layer-1'), enabled: true });

      expect(map.layers.get('layer-1')).toMatchObject({ enabled: true, visible: true });
    });

    it('shows an enabled layer added to a visible group', () => {
      const { manager, map } = createManager();
      manager.addGroup({ ...group('group-1'), visible: true });

      manager.addLayer({ ...layer('child-1', { parentId: 'group-1' }), enabled: true });

      expect(map.layers.get('child-1')).toMatchObject({ enabled: true, visible: true });
    });

    it('keeps an enabled layer added to a switched-off group enabled but hidden', () => {
      const { manager, map } = createManager();
      manager.addGroup(group('group-1'));

      manager.addLayer({ ...layer('child-1', { parentId: 'group-1' }), enabled: true });

      expect(map.layers.get('child-1')).toMatchObject({ enabled: true, visible: false });
      expect(map.layers.get('group-1')).toMatchObject({ enabled: false, visible: false });
    });

    it('switches on a group when a visible layer is added to it', () => {
      const { manager, map } = createManager();
      manager.addGroup(group('group-1'));

      manager.addLayer({ ...layer('child-1', { parentId: 'group-1' }), visible: true });

      expect(map.visibleLayerIds()).toEqual(['child-1', 'group-1']);
    });

    it('shows a group added as visible', () => {
      const { manager, map } = createManager();

      manager.addGroup({ ...group('group-1'), visible: true });

      expect(map.layers.get('group-1')).toMatchObject({ enabled: true, visible: true });
    });

    it('keeps an enabled group added to a switched-off group enabled but hidden', () => {
      const { manager, map } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup(group('outer'));

      manager.addGroup({ ...group('inner', 'outer'), enabled: true });

      expect(map.layers.get('inner')).toMatchObject({ enabled: true, visible: false });
    });
  });

  describe('visibility', () => {
    it('hides a layer that is switched off', () => {
      const { manager, map } = createManager();
      manager.addLayer({ ...layer('layer-1'), visible: true });

      manager.setEnabled('layer-1', false);

      expect(map.layers.get('layer-1')).toMatchObject({ enabled: false, visible: false });
    });

    it('shows a layer that is switched on', () => {
      const { manager, map } = createManager();
      manager.addLayer(layer('layer-1'));

      manager.setEnabled('layer-1', true);

      expect(map.layers.get('layer-1')).toMatchObject({ enabled: true, visible: true });
    });

    it('reports visibility only when it changes', () => {
      const onVisibilityChanged = vi.fn();
      const { manager } = createManager({ onVisibilityChanged });
      manager.addLayer({ ...layer('layer-1'), visible: true });
      onVisibilityChanged.mockClear();

      manager.setEnabled('layer-1', true);

      expect(onVisibilityChanged).not.toHaveBeenCalled();
    });

    it('hides the layers of a group that is switched off but keeps them switched on', () => {
      const { manager, map } = createManager();
      manager.addGroup({ ...group('group-1'), visible: true });
      manager.addLayer({ ...layer('c1', { parentId: 'group-1' }), visible: true });
      manager.addLayer({ ...layer('c2', { parentId: 'group-1' }), visible: true });

      manager.setEnabled('group-1', false);

      expect(map.visibleLayerIds()).toEqual([]);
      expect(map.layers.get('c1')).toMatchObject({ enabled: true, visible: false });
      expect(map.layers.get('c2')).toMatchObject({ enabled: true, visible: false });
    });

    it('shows only the switched-on layers when their group is switched back on', () => {
      const { manager, map } = createManager();
      manager.addGroup({ ...group('group-1'), visible: true });
      manager.addLayer({ ...layer('on', { parentId: 'group-1' }), visible: true });
      manager.addLayer(layer('off', { parentId: 'group-1' }));
      manager.setEnabled('group-1', false);

      manager.setEnabled('group-1', true);

      expect(map.visibleLayerIds()).toEqual(['group-1', 'on']);
    });

    it('hides the layers of nested groups when the outer group is switched off', () => {
      const { manager, map } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup({ ...group('outer'), visible: true });
      manager.addGroup({ ...group('inner', 'outer'), visible: true });
      manager.addLayer({ ...layer('layer-1', { parentId: 'inner' }), visible: true });

      manager.setEnabled('outer', false);

      expect(map.visibleLayerIds()).toEqual([]);
      expect(map.layers.get('inner')).toMatchObject({ enabled: true });
      expect(map.layers.get('layer-1')).toMatchObject({ enabled: true });
    });

    it('switches on every group above a layer that is switched on', () => {
      const { manager, map } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup(group('outer'));
      manager.addGroup(group('inner', 'outer'));
      manager.addLayer(layer('layer-1', { parentId: 'inner' }));

      manager.setEnabled('layer-1', true);

      expect(map.visibleLayerIds()).toEqual(['inner', 'layer-1', 'outer']);
    });
  });

  describe('opacity', () => {
    it('reports a top-level layer\'s opacity as its computed opacity', () => {
      const { manager, map } = createManager();
      manager.addLayer(layer('layer-1'));

      manager.setOpacity('layer-1', 0.5);

      expect(map.layers.get('layer-1')).toMatchObject({ opacity: 0.5, computedOpacity: 0.5 });
    });

    it('updates the computed opacity of a group\'s layers when the group\'s opacity changes', () => {
      const { manager, map } = createManager();
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('layer-1', { parentId: 'group-1', opacity: 0.8 }));

      manager.setOpacity('group-1', 0.25);

      expect(map.layers.get('group-1')).toMatchObject({ opacity: 0.25, computedOpacity: 0.25 });
      expect(map.layers.get('layer-1')).toMatchObject({ opacity: 0.8, computedOpacity: 0.2 });
    });

    it('combines a layer\'s new opacity with its group\'s current opacity', () => {
      const { manager, map } = createManager();
      manager.addGroup({ layerConfig: createTestLayerGroupConfig<TestLayerData>({ layerId: 'group-1', opacity: 0.5 }) });
      manager.addLayer(layer('layer-1', { parentId: 'group-1' }));

      manager.setOpacity('layer-1', 0.8);

      expect(map.layers.get('layer-1')).toMatchObject({ opacity: 0.8, computedOpacity: 0.4 });
    });

    it('updates the computed opacity through nested groups', () => {
      const { manager, map } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup(group('outer'));
      manager.addGroup({ layerConfig: createTestLayerGroupConfig<TestLayerData>({ layerId: 'inner', parentId: 'outer', opacity: 0.8 }) });
      manager.addLayer(layer('layer-1', { parentId: 'inner', opacity: 0.5 }));

      manager.setOpacity('outer', 0.5);

      expect(map.layers.get('inner')).toMatchObject({ computedOpacity: 0.4 });
      expect(map.layers.get('layer-1')).toMatchObject({ computedOpacity: 0.2 });
    });
  });

  describe('time info and layer data', () => {
    it('reports a layer\'s new time info', () => {
      const onTimeInfoChanged = vi.fn();
      const { manager, map } = createManager({ onTimeInfoChanged });
      manager.addLayer(layer('layer-1'));

      manager.setTimeInfo('layer-1', newYearsDay);

      expect(map.layers.get('layer-1')?.timeInfo).toEqual(newYearsDay);
      expect(onTimeInfoChanged).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'layer-1' }), newYearsDay);
    });

    it('gives the map a layer\'s Temporal date range', () => {
      const { manager, map } = createManager();

      manager.addLayer(layer('layer-1', {
        timeInfo: {
          type: 'range',
          precision: 'date',
          start: Temporal.PlainDate.from('2026-06-01'),
          end: Temporal.PlainDate.from('2026-08-31'),
        },
      }));

      expect(map.layers.get('layer-1')?.timeInfo).toEqual({
        type: 'range',
        precision: 'date',
        start: Temporal.PlainDate.from('2026-06-01'),
        end: Temporal.PlainDate.from('2026-08-31'),
      });
    });

    it('reports a layer\'s new data through onLayerDataChanged', () => {
      const onLayerDataChanged = vi.fn();
      const { manager } = createManager({ onLayerDataChanged });
      manager.addLayer(layer('layer-1'));

      manager.updateLayerData('layer-1', { test: 'updated' });

      expect(onLayerDataChanged).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'layer-1', layerData: { test: 'updated' } }));
    });

    it('passes a layer\'s new data to the adapter', () => {
      const { manager, map } = createManager();
      manager.addLayer(layer('layer-1'));

      manager.updateLayerData('layer-1', { test: 'updated' });

      expect(map.layers.get('layer-1')?.layerData).toEqual({ test: 'updated' });
    });

    it('passes a group\'s new data to the adapter', () => {
      const { manager, map } = createManager();
      manager.addGroup(group('group-1'));

      manager.updateLayerData('group-1', { test: 'group-updated' });

      expect(map.layers.get('group-1')?.layerData).toEqual({ test: 'group-updated' });
    });
  });

  describe('removing layers', () => {
    it('removes a layer from the manager and the map and stops it', () => {
      const onLayerRemoved = vi.fn();
      const { manager, map } = createManager({ onLayerRemoved });
      manager.addLayer(layer('a'));
      manager.addLayer(layer('b'));
      const removed = manager.getLayer('a');

      manager.removeLayer('a');

      expect(onLayerRemoved).toHaveBeenCalledWith('a');
      expect(removed?.layerActor.getSnapshot().status).toBe('stopped');
      expect(topLevelIds(manager)).toEqual(['b']);
      expect(manager.getLayer('a')).toBeUndefined();
      expect([...map.layers.keys()]).toEqual(['b']);
    });

    it('removes a layer from its group', () => {
      const { manager } = createManager();
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('c1', { parentId: 'group-1' }));
      manager.addLayer(layer('c2', { parentId: 'group-1' }));

      manager.removeLayer('c1');

      expect(childIdsOf(manager, 'group-1')).toEqual(['c2']);
    });

    it('removes a group once it is empty', () => {
      const { manager } = createManager();
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('c1', { parentId: 'group-1' }));

      manager.removeLayer('c1');
      manager.removeLayer('group-1');

      expect(manager.layers).toEqual([]);
    });
  });

  describe('nested groups', () => {
    it('adds a group inside another group when nested groups are allowed', () => {
      const { manager } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup(group('outer'));

      manager.addGroup(group('inner', 'outer'));

      expect(childIdsOf(manager, 'outer')).toEqual(['inner']);
    });

    it('rejects a group inside another group by default', () => {
      const onError = vi.fn();
      const { manager } = createManager({ onError });
      manager.addGroup(group('outer'));

      manager.addGroup(group('inner', 'outer'));

      expect(onError).toHaveBeenCalledWith(new Error('Nested group layers are not allowed.'));
      expect(manager.getLayer('inner')).toBeUndefined();
    });
  });

  describe('rejected changes', () => {
    it('reports adding a layer with an id that is already in use through onError', () => {
      const onError = vi.fn();
      const { manager } = createManager({ onError });
      manager.addLayer(layer('layer-1'));

      manager.addLayer(layer('layer-1'));

      expect(onError).toHaveBeenCalledWith(new Error('Layer with ID layer-1 already exists. Layer not added.'));
      expect(manager.layers).toHaveLength(1);
    });

    it('reports adding a layer to a parent that does not exist through onError', () => {
      const onError = vi.fn();
      const { manager } = createManager({ onError });

      manager.addLayer(layer('child-1', { parentId: 'missing-group' }));

      expect(onError).toHaveBeenCalledWith(new Error('Unable to find parent group missing-group. Layer child-1 not added.'));
      expect(manager.getLayer('child-1')).toBeUndefined();
    });

    it('reports removing a layer that does not exist through onError', () => {
      const onError = vi.fn();
      const { manager } = createManager({ onError });

      manager.removeLayer('missing-layer');

      expect(onError).toHaveBeenCalledWith(new Error('Unable to find layer missing-layer. Layer not removed.'));
    });

    it('reports removing a group that still has children through onError', () => {
      const onError = vi.fn();
      const { manager } = createManager({ onError });
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('child-1', { parentId: 'group-1' }));

      manager.removeLayer('group-1');

      expect(onError).toHaveBeenCalledWith(new Error('Layer group group-1 has children. Layer not removed.'));
      expect(manager.getLayer('group-1')).toBeDefined();
    });

    it('reports moving a layer that does not exist through onError and keeps the order', () => {
      const onError = vi.fn();
      const onOrderChanged = vi.fn();
      const { manager } = createManager({ onError, onOrderChanged });
      manager.addLayer(layer('layer-1'));
      onOrderChanged.mockClear();

      manager.moveLayer('missing-layer', { parentId: null, position: 'top' });

      expect(onError).toHaveBeenCalledWith(new Error('Unable to find layer missing-layer. Layer not moved.'));
      expect(topLevelIds(manager)).toEqual(['layer-1']);
      expect(onOrderChanged).not.toHaveBeenCalled();
    });

    it('reports moving a layer into a parent that is missing or not a group through onError and keeps the order', () => {
      const onError = vi.fn();
      const onOrderChanged = vi.fn();
      const { manager } = createManager({ onError, onOrderChanged });
      manager.addLayer({ ...layer('layer-1'), position: 'top' });
      manager.addLayer({ ...layer('layer-2'), position: 'top' });
      onOrderChanged.mockClear();

      manager.moveLayer('layer-1', { parentId: 'missing-group' });
      manager.moveLayer('layer-1', { parentId: 'layer-2' });

      expect(onError.mock.calls.map(([error]) => error)).toEqual([
        new Error('Unable to find parent group missing-group. Layer layer-1 not moved.'),
        new Error('Unable to find parent group layer-2. Layer layer-1 not moved.'),
      ]);
      expect(topLevelIds(manager)).toEqual(['layer-1', 'layer-2']);
      expect(onOrderChanged).not.toHaveBeenCalled();
    });

    it('reports moving a group into itself or one of its descendants through onError and keeps the order', () => {
      const onError = vi.fn();
      const onOrderChanged = vi.fn();
      const { manager } = createManager({ allowNestedGroupLayers: true, onError, onOrderChanged });
      manager.addGroup(group('outer'));
      manager.addGroup(group('inner', 'outer'));
      onOrderChanged.mockClear();

      manager.moveLayer('outer', { parentId: 'outer' });
      manager.moveLayer('outer', { parentId: 'inner' });

      expect(onError.mock.calls.map(([error]) => error)).toEqual([
        new Error('Layer group outer cannot be moved into itself or one of its descendants. Layer not moved.'),
        new Error('Layer group outer cannot be moved into itself or one of its descendants. Layer not moved.'),
      ]);
      expect(topLevelIds(manager)).toEqual(['outer']);
      expect(childIdsOf(manager, 'outer')).toEqual(['inner']);
      expect(onOrderChanged).not.toHaveBeenCalled();
    });

    it('reports moving a group into another group while nesting is off through onError and keeps the order', () => {
      const onError = vi.fn();
      const onOrderChanged = vi.fn();
      const { manager } = createManager({ allowNestedGroupLayers: false, onError, onOrderChanged });
      manager.addGroup({ ...group('group-1'), position: 'top' });
      manager.addGroup({ ...group('group-2'), position: 'top' });
      onOrderChanged.mockClear();

      manager.moveLayer('group-1', { parentId: 'group-2' });

      expect(onError).toHaveBeenCalledWith(new Error('Nested group layers are not allowed.'));
      expect(topLevelIds(manager)).toEqual(['group-1', 'group-2']);
      expect(onOrderChanged).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('removes every layer and reports each removal', () => {
      const onLayerRemoved = vi.fn();
      const { manager, map } = createManager({ onLayerRemoved });
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('child-1', { parentId: 'group-1' }));
      manager.addLayer(layer('layer-1'));

      manager.reset();

      expect(onLayerRemoved.mock.calls.map(([layerId]) => layerId).sort()).toEqual(['child-1', 'group-1', 'layer-1']);
      expect(manager.layers).toEqual([]);
      expect(map.layers.size).toBe(0);
    });

    it('stops every layer', () => {
      const { manager } = createManager();
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('layer-1'));
      const groupItem = manager.getLayer('group-1');
      const layerItem = manager.getLayer('layer-1');

      manager.reset();

      expect(groupItem?.layerActor.getSnapshot().status).toBe('stopped');
      expect(layerItem?.layerActor.getSnapshot().status).toBe('stopped');
    });

    it('accepts new layers with previously used ids', () => {
      const { manager } = createManager();
      manager.addLayer(layer('layer-1'));
      manager.reset();

      manager.addLayer(layer('layer-1'));

      expect(topLevelIds(manager)).toEqual(['layer-1']);
    });
  });

  describe('adapter', () => {
    it('registers an adapter with callbacks that read the manager\'s layers', () => {
      const manager: TestManager = new LayerManager<TestLayerData, TestLayerData>();
      let callbacks: LayerManagerCallbacks<TestLayerData, TestLayerData> | undefined;
      const register = vi.fn((_manager: TestManager, registered: LayerManagerCallbacks<TestLayerData, TestLayerData>) => {
        callbacks = registered;
      });
      manager.setAdapter({ register });
      manager.addLayer(layer('layer-1'));

      expect(register).toHaveBeenCalledWith(manager, expect.anything());
      expect(callbacks?.getSnapshot().map((item) => item.layerActor.id)).toEqual(['layer-1']);
      expect(callbacks?.getLayer('layer-1')?.layerActor.id).toBe('layer-1');
    });

    it('unregisters the previous adapter when a new one is attached', () => {
      const { manager, map } = createManager();
      const next: LayerManagerAdapter<TestLayerData, TestLayerData> = { register: vi.fn() };

      manager.setAdapter(next);

      expect(map.registered).toBe(false);
      expect(next.register).toHaveBeenCalledTimes(1);
    });

    it('shows the layers already added on a map attached afterwards', () => {
      const manager: TestManager = new LayerManager<TestLayerData, TestLayerData>();
      manager.addGroup({ ...group('group-1'), visible: true });
      manager.addLayer({ ...layer('layer-1', { parentId: 'group-1' }), visible: true });
      manager.addLayer(layer('layer-2'));
      const map = createMapModel<TestLayerData>();

      manager.setAdapter(map);

      expect([...map.layers.keys()].sort()).toEqual(['group-1', 'layer-1', 'layer-2']);
      expect(map.visibleLayerIds()).toEqual(['group-1', 'layer-1']);
    });

    it('stacks a map attached afterwards in the manager\'s order', () => {
      const manager: TestManager = new LayerManager<TestLayerData, TestLayerData>();
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('layer-1', { parentId: 'group-1' }));
      manager.addLayer({ ...layer('layer-2'), position: 'top' });
      const map = createMapModel<TestLayerData>();

      manager.setAdapter(map);

      expect(map.order).toEqual(['group-1', 'layer-1', 'layer-2']);
    });

    it('stops updating an adapter once it is detached', () => {
      const { manager, map } = createManager();

      manager.setAdapter(null);
      manager.addLayer(layer('layer-1'));

      expect(map.registered).toBe(false);
      expect(map.layers.size).toBe(0);
    });

    it('lets an inspector see the events and actors behind each change', () => {
      const inspect = vi.fn();
      const { manager } = createManager({ inspect });

      manager.addLayer(layer('layer-1'));

      expect(inspect).toHaveBeenCalledWith(expect.objectContaining({
        type: '@xstate.event',
        event: expect.objectContaining({ type: 'LAYER.ADD' }),
      }));
      expect(inspect).toHaveBeenCalledWith(expect.objectContaining({
        type: '@xstate.actor',
        actorRef: expect.objectContaining({ id: 'layer-1' }),
      }));
    });

    it('unregisters the adapter when the manager is destroyed', () => {
      const { manager, map } = createManager();

      manager.destroy();

      expect(map.registered).toBe(false);
      expect(manager.destroyed).toBe(true);
      expect(manager.isReady).toBe(false);
    });
  });
});
