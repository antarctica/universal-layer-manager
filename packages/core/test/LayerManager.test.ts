import type { LayerInfo, LayerManagerAdapter, RenderAdapterOptions } from '../src/adapters/types';
import type { LayerManagerOptions } from '../src/LayerManager';
import type { LayerConfig, SingleTimeInfo } from '../src/types';
import type { TestLayerData } from './utils/layer-manager-helpers';
import type { MapModel } from './utils/map-model';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { LayerManager } from '../src/LayerManager';
import { monitorContract } from './utils/contract-monitor';
import { createTestLayerConfig, createTestLayerGroupConfig } from './utils/layer-manager-helpers';
import { createMapModel } from './utils/map-model';

type TestManager = LayerManager<TestLayerData>;

function createManager(options: LayerManagerOptions<TestLayerData> = {}) {
  const manager: TestManager = new LayerManager<TestLayerData>(options);
  const map = createMapModel<TestLayerData>();
  const monitor = monitorContract(map);
  manager.setAdapter(monitor.adapter);
  onTestFinished(() => {
    monitor.assertMet();
    if (map.registered) {
      expectTreeToMatchMap(manager, map);
    }
  });
  return { manager, map };
}

function expectTreeToMatchMap(manager: TestManager, map: MapModel<TestLayerData>) {
  const { rootIds, layers } = manager.getTree();
  const flatOrder = (ids: readonly string[]): string[] => ids.flatMap((id) => {
    const info = layers[id];
    return [id, ...(info?.layerType === 'layerGroup' ? flatOrder(info.childIds) : [])];
  });
  expect(Object.keys(layers).sort()).toEqual([...map.layers.keys()].sort());
  map.layers.forEach((state, layerId) => {
    expect(layers[layerId]).toMatchObject(state);
  });
  expect(flatOrder(rootIds)).toEqual(map.order);
}

function layer(layerId: string, overrides: Partial<LayerConfig<TestLayerData>> = {}) {
  return { layerConfig: createTestLayerConfig({ layerId, ...overrides }) };
}

function group(layerId: string, parentId: string | null = null) {
  return { layerConfig: createTestLayerGroupConfig({ layerId, parentId }) };
}

function topLevelIds(manager: TestManager): string[] {
  return [...manager.getTree().rootIds];
}

function childIdsOf(manager: TestManager, groupId: string): string[] {
  const info = manager.getTree().layers[groupId];
  return info?.layerType === 'layerGroup' ? info.childIds : [];
}

function actorOf(manager: TestManager, layerId: string) {
  return manager.actor.getSnapshot().children[layerId];
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

    it('adds a layer without a parentId at the top level', () => {
      const { manager, map } = createManager();

      manager.addLayer({ layerConfig: { layerId: 'a', layerName: 'A', layerType: 'layer', layerData: { test: 'a' } } });

      expect(topLevelIds(manager)).toEqual(['a']);
      expect(map.layers.get('a')).toMatchObject({ parentId: null });
    });

    it('gives a layer the list mode set in its config', () => {
      const { manager, map } = createManager();

      manager.addLayer({ layerConfig: { layerId: 'a', layerName: 'A', layerType: 'layer', layerData: { test: 'a' }, listMode: 'hide' } });

      expect(map.layers.get('a')).toMatchObject({ listMode: 'hide' });
    });

    it('adds a top-level layer at the top or at an index when asked', () => {
      const { manager } = createManager();
      manager.addLayer(layer('a'));
      manager.addLayer(layer('b'));

      manager.addLayer({ ...layer('top'), position: 'top' });
      manager.addLayer({ ...layer('middle'), index: 1 });

      expect(topLevelIds(manager)).toEqual(['b', 'middle', 'a', 'top']);
    });

    it('adds a layer at the top when its index is above the number of layers', () => {
      const { manager } = createManager();
      manager.addLayer(layer('a'));
      manager.addLayer(layer('b'));

      manager.addLayer({ ...layer('high'), index: 99 });

      expect(topLevelIds(manager)).toEqual(['b', 'a', 'high']);
    });

    it('adds a layer at the bottom when its index is negative, even when the position is top', () => {
      const { manager } = createManager();
      manager.addLayer(layer('a'));
      manager.addLayer(layer('b'));

      manager.addLayer({ ...layer('low'), index: -1, position: 'top' });

      expect(topLevelIds(manager)).toEqual(['low', 'b', 'a']);
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

    it('gives a group\'s info the IDs of its children, bottom first', () => {
      const onEnabledChanged = vi.fn();
      const { manager } = createManager({ onEnabledChanged });
      manager.addGroup({ ...group('group-1'), enabled: false });
      manager.addLayer({ ...layer('c1', { parentId: 'group-1' }), position: 'top' });
      manager.addLayer({ ...layer('c2', { parentId: 'group-1' }), position: 'top' });

      manager.setEnabled('group-1', true);

      expect(onEnabledChanged).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'group-1', childIds: ['c1', 'c2'] }), true);
    });

    it('gives a group its child actors in display order', () => {
      const { manager } = createManager();
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('c1', { parentId: 'group-1' }));
      manager.addLayer({ ...layer('c2', { parentId: 'group-1' }), position: 'top' });

      const context = actorOf(manager, 'group-1')?.getSnapshot().context;
      const children = context && 'children' in context ? context.children : [];

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

    it('moves a layer to the top of its group when the index is above the number of children', () => {
      const { manager, map } = createManager();
      manager.addGroup(group('group-1'));
      ['c1', 'c2', 'c3'].forEach((layerId) => manager.addLayer({ ...layer(layerId, { parentId: 'group-1' }), position: 'top' }));

      manager.moveLayer('c1', { parentId: 'group-1', index: 99 });

      expect(childIdsOf(manager, 'group-1')).toEqual(['c2', 'c3', 'c1']);
      expect(map.order).toEqual(['group-1', 'c2', 'c3', 'c1']);
    });

    it('reports no order change and no move when a layer is moved to the index it already has', () => {
      const onOrderChanged = vi.fn();
      const onLayerMoved = vi.fn();
      const { manager } = createManager({ onOrderChanged, onLayerMoved });
      ['a', 'b', 'c'].forEach((layerId) => manager.addLayer({ ...layer(layerId), position: 'top' }));
      onOrderChanged.mockClear();

      manager.moveLayer('b', { parentId: null, index: 1 });

      expect(onOrderChanged).not.toHaveBeenCalled();
      expect(onLayerMoved).not.toHaveBeenCalled();
      expect(topLevelIds(manager)).toEqual(['a', 'b', 'c']);
    });

    it('reports no order change and no move when the top layer of a group is moved to the top of that group', () => {
      const onOrderChanged = vi.fn();
      const onLayerMoved = vi.fn();
      const { manager } = createManager({ onOrderChanged, onLayerMoved });
      manager.addGroup(group('group-1'));
      ['c1', 'c2'].forEach((layerId) => manager.addLayer({ ...layer(layerId, { parentId: 'group-1' }), position: 'top' }));
      onOrderChanged.mockClear();

      manager.moveLayer('c2', { parentId: 'group-1', position: 'top' });

      expect(onOrderChanged).not.toHaveBeenCalled();
      expect(onLayerMoved).not.toHaveBeenCalled();
      expect(childIdsOf(manager, 'group-1')).toEqual(['c1', 'c2']);
    });

    it('reports a move out of a group even when the map order stays the same', () => {
      const onLayerMoved = vi.fn();
      const { manager, map } = createManager({ onLayerMoved });
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('c1', { parentId: 'group-1' }));

      manager.moveLayer('c1', { parentId: null, position: 'top' });

      expect(onLayerMoved).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'c1', parentId: null }));
      expect(map.order).toEqual(['group-1', 'c1']);
      expect(topLevelIds(manager)).toEqual(['group-1', 'c1']);
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
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1', opacity: 0.5 }) });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-2', opacity: 0.25 }) });
      manager.addLayer(layer('c1', { parentId: 'group-1', opacity: 0.8 }));

      manager.moveLayer('c1', { parentId: 'group-2' });

      expect(map.layers.get('c1')).toMatchObject({ opacity: 0.8, computedOpacity: 0.2 });
    });

    it('updates the computed opacity of a moved group\'s layers', () => {
      const { manager, map } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1', opacity: 0.5 }) });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-2', opacity: 0.25 }) });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'inner', parentId: 'group-1', opacity: 0.8 }) });
      manager.addLayer(layer('c1', { parentId: 'inner', opacity: 0.5 }));

      manager.moveLayer('inner', { parentId: 'group-2' });

      expect(map.layers.get('inner')).toMatchObject({ opacity: 0.8, computedOpacity: 0.2 });
      expect(map.layers.get('c1')).toMatchObject({ opacity: 0.5, computedOpacity: 0.1 });
    });

    it('reports opacity after a move only when the computed opacity changes', () => {
      const onOpacityChanged = vi.fn();
      const { manager } = createManager({ onOpacityChanged });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1', opacity: 0.5 }) });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-2', opacity: 0.5 }) });
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
      const manager: TestManager = new LayerManager<TestLayerData>({ onLayerMoved });
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
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1', opacity: 0.5 }) });

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

    it('adds a group without layer data while groups carry none', () => {
      const { manager } = createManager();

      manager.addGroup({ layerConfig: { layerId: 'group-1', layerName: 'Group', layerType: 'layerGroup' } });

      expect(manager.getTree().layers['group-1']).toMatchObject({ layerType: 'layerGroup', layerData: undefined });
    });

    it('needs layer data for a layer whose data type has no undefined', () => {
      const { manager } = createManager();

      // @ts-expect-error TestLayerData does not include undefined, so a layer must carry it.
      manager.addLayer({ layerConfig: { layerId: 'layer-1', layerName: 'Layer', layerType: 'layer' } });

      expect(manager.getTree().layers['layer-1']?.layerData).toBeUndefined();
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

    it('reports a layer added as visible as not yet visible in onLayerAdded, then reports it visible once', () => {
      const onLayerAdded = vi.fn();
      const onVisibilityChanged = vi.fn();
      const { manager } = createManager({ onLayerAdded, onVisibilityChanged });

      manager.addLayer({ ...layer('layer-1'), visible: true });

      expect(onLayerAdded).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'layer-1', visible: false }));
      expect(onVisibilityChanged.mock.calls).toEqual([[expect.objectContaining({ layerId: 'layer-1', visible: true }), true]]);
    });

    it('adds a layer added as visible hidden, so onLayerAdded reports the state the layer is in', () => {
      const shownWhenAdded: boolean[] = [];
      const { manager } = createManager({
        onLayerAdded: (info) => {
          shownWhenAdded.push(manager.getTree().layers[info.layerId]?.visible ?? true);
        },
      });

      manager.addLayer({ ...layer('layer-1'), visible: true });

      expect(shownWhenAdded).toEqual([false]);
      expect(manager.getTree().layers['layer-1']?.visible).toBe(true);
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

    it('reports a layer hidden by a switched-off group being switched off', () => {
      const onEnabledChanged = vi.fn();
      const manager = new LayerManager<TestLayerData>({ onEnabledChanged });
      manager.addGroup({ ...group('group-1'), enabled: false });
      manager.addLayer({ ...layer('layer-1', { parentId: 'group-1' }), enabled: true });

      manager.setEnabled('layer-1', false);

      expect(onEnabledChanged).toHaveBeenCalledTimes(1);
      expect(onEnabledChanged).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'layer-1', enabled: false, visible: false }), false);
    });

    it('tells the map that a layer hidden by a switched-off group is switched off', () => {
      const { manager, map } = createManager();
      manager.addGroup({ ...group('group-1'), enabled: false });
      manager.addLayer({ ...layer('layer-1', { parentId: 'group-1' }), enabled: true });

      manager.setEnabled('layer-1', false);

      expect(map.layers.get('layer-1')).toMatchObject({ enabled: false, visible: false });
    });

    it('reports no enabled change when a switched-on layer and group are added', () => {
      const onEnabledChanged = vi.fn();
      const { manager } = createManager({ onEnabledChanged });

      manager.addGroup({ ...group('group-1'), enabled: true });
      manager.addLayer({ ...layer('layer-1', { parentId: 'group-1' }), enabled: true });

      expect(onEnabledChanged).not.toHaveBeenCalled();
    });

    it('reports no enabled change when a switched-on or switched-off layer is removed', () => {
      const onEnabledChanged = vi.fn();
      const { manager } = createManager({ onEnabledChanged });
      manager.addLayer({ ...layer('on'), enabled: true });
      manager.addLayer({ ...layer('off'), enabled: false });

      manager.removeLayer('on');
      manager.removeLayer('off');

      expect(onEnabledChanged).not.toHaveBeenCalled();
    });

    it('reports a layer being switched on', () => {
      const onEnabledChanged = vi.fn();
      const { manager } = createManager({ onEnabledChanged });
      manager.addLayer({ ...layer('layer-1'), enabled: false });

      manager.setEnabled('layer-1', true);

      expect(onEnabledChanged.mock.calls).toEqual([[expect.objectContaining({ layerId: 'layer-1', enabled: true }), true]]);
    });

    it('reports a group being switched off and back on', () => {
      const onEnabledChanged = vi.fn();
      const { manager } = createManager({ onEnabledChanged });
      manager.addGroup({ ...group('group-1'), enabled: true });

      manager.setEnabled('group-1', false);
      manager.setEnabled('group-1', true);

      expect(onEnabledChanged.mock.calls).toEqual([
        [expect.objectContaining({ layerId: 'group-1' }), false],
        [expect.objectContaining({ layerId: 'group-1' }), true],
      ]);
    });

    it('reports each switched-off group above a layer that is switched on', () => {
      const onEnabledChanged = vi.fn();
      const { manager } = createManager({ allowNestedGroupLayers: true, onEnabledChanged });
      manager.addGroup({ ...group('outer'), enabled: false });
      manager.addGroup({ ...group('inner', 'outer'), enabled: false });
      manager.addLayer({ ...layer('layer-1', { parentId: 'inner' }), enabled: false });

      manager.setEnabled('layer-1', true);

      expect(onEnabledChanged.mock.calls.map(([info, enabled]) => [info.layerId, enabled])).toEqual([
        ['layer-1', true],
        ['inner', true],
        ['outer', true],
      ]);
    });
  });

  describe('showing a layer', () => {
    it('shows a switched-on layer hidden by a switched-off group by switching the group on', () => {
      const { manager, map } = createManager();
      manager.addGroup({ ...group('group-1'), enabled: false });
      manager.addLayer({ ...layer('layer-1', { parentId: 'group-1' }), enabled: true });

      manager.showLayer('layer-1');

      expect(map.layers.get('group-1')).toMatchObject({ enabled: true, visible: true });
      expect(map.layers.get('layer-1')).toMatchObject({ enabled: true, visible: true });
    });

    it('reports only the group as switched on when showing a switched-on layer it hides', () => {
      const onEnabledChanged = vi.fn();
      const { manager } = createManager({ onEnabledChanged });
      manager.addGroup({ ...group('group-1'), enabled: false });
      manager.addLayer({ ...layer('layer-1', { parentId: 'group-1' }), enabled: true });

      manager.showLayer('layer-1');

      expect(onEnabledChanged.mock.calls.map(([info, enabled]) => [info.layerId, enabled])).toEqual([['group-1', true]]);
    });

    it('reports nothing when showing a layer that is already showing', () => {
      const onEnabledChanged = vi.fn();
      const onVisibilityChanged = vi.fn();
      const { manager } = createManager({ onEnabledChanged, onVisibilityChanged });
      manager.addGroup({ ...group('group-1'), enabled: true });
      manager.addLayer({ ...layer('layer-1', { parentId: 'group-1' }), enabled: true });
      onVisibilityChanged.mockClear();

      manager.showLayer('layer-1');

      expect(onEnabledChanged).not.toHaveBeenCalled();
      expect(onVisibilityChanged).not.toHaveBeenCalled();
    });

    it('shows a switched-on group hidden by a switched-off outer group by switching the outer group on', () => {
      const { manager, map } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup({ ...group('outer'), enabled: false });
      manager.addGroup({ ...group('inner', 'outer'), enabled: true });

      manager.showLayer('inner');

      expect(map.layers.get('outer')).toMatchObject({ enabled: true, visible: true });
      expect(map.layers.get('inner')).toMatchObject({ enabled: true, visible: true });
    });

    it('shows a switched-off group by switching it and its outer group on', () => {
      const { manager, map } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup({ ...group('outer'), enabled: false });
      manager.addGroup({ ...group('inner', 'outer'), enabled: false });

      manager.showLayer('inner');

      expect(map.layers.get('outer')).toMatchObject({ enabled: true, visible: true });
      expect(map.layers.get('inner')).toMatchObject({ enabled: true, visible: true });
    });

    it('shows a switched-off layer by switching it and its group on', () => {
      const { manager, map } = createManager();
      manager.addGroup({ ...group('group-1'), enabled: false });
      manager.addLayer({ ...layer('layer-1', { parentId: 'group-1' }), enabled: false });

      manager.showLayer('layer-1');

      expect(map.layers.get('group-1')).toMatchObject({ enabled: true, visible: true });
      expect(map.layers.get('layer-1')).toMatchObject({ enabled: true, visible: true });
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
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1', opacity: 0.5 }) });
      manager.addLayer(layer('layer-1', { parentId: 'group-1' }));

      manager.setOpacity('layer-1', 0.8);

      expect(map.layers.get('layer-1')).toMatchObject({ opacity: 0.8, computedOpacity: 0.4 });
    });

    it('updates the computed opacity through nested groups', () => {
      const { manager, map } = createManager({ allowNestedGroupLayers: true });
      manager.addGroup(group('outer'));
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'inner', parentId: 'outer', opacity: 0.8 }) });
      manager.addLayer(layer('layer-1', { parentId: 'inner', opacity: 0.5 }));

      manager.setOpacity('outer', 0.5);

      expect(map.layers.get('inner')).toMatchObject({ computedOpacity: 0.4 });
      expect(map.layers.get('layer-1')).toMatchObject({ computedOpacity: 0.2 });
    });

    it('accepts an opacity of 0 and of 1', () => {
      const onError = vi.fn();
      const { manager, map } = createManager({ onError });
      manager.addLayer(layer('layer-0', { opacity: 0.5 }));
      manager.addLayer(layer('layer-1', { opacity: 0.5 }));

      manager.setOpacity('layer-0', 0);
      manager.setOpacity('layer-1', 1);

      expect(onError).not.toHaveBeenCalled();
      expect(map.layers.get('layer-0')).toMatchObject({ opacity: 0, computedOpacity: 0 });
      expect(map.layers.get('layer-1')).toMatchObject({ opacity: 1, computedOpacity: 1 });
    });

    it('reports no change when a layer is set to the opacity it already has', () => {
      const onOpacityChanged = vi.fn();
      const { manager } = createManager({ onOpacityChanged });
      manager.addLayer(layer('layer-1', { opacity: 0.5 }));

      manager.setOpacity('layer-1', 0.5);

      expect(onOpacityChanged).not.toHaveBeenCalled();
    });

    it('reports no opacity change for a layer whose computed opacity stays the same when its group fades', () => {
      const onOpacityChanged = vi.fn();
      const { manager } = createManager({ onOpacityChanged });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1', opacity: 1 }) });
      manager.addLayer(layer('transparent', { parentId: 'group-1', opacity: 0 }));

      manager.setOpacity('group-1', 0.5);

      expect(onOpacityChanged.mock.calls.map(([info]) => info.layerId)).toEqual(['group-1']);
    });

    it('reports no opacity change for a group whose computed opacity stays the same when its outer group fades', () => {
      const onOpacityChanged = vi.fn();
      const { manager } = createManager({ allowNestedGroupLayers: true, onOpacityChanged });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'outer', opacity: 1 }) });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'inner', parentId: 'outer', opacity: 0 }) });

      manager.setOpacity('outer', 0.5);

      expect(onOpacityChanged.mock.calls.map(([info]) => info.layerId)).toEqual(['outer']);
    });

    it('reports no change when a group is set to the opacity it already has', () => {
      const onOpacityChanged = vi.fn();
      const { manager } = createManager({ onOpacityChanged });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1', opacity: 0.5 }) });
      manager.addLayer(layer('layer-1', { parentId: 'group-1', opacity: 0.8 }));

      manager.setOpacity('group-1', 0.5);

      expect(onOpacityChanged).not.toHaveBeenCalled();
    });

    it('reports a layer opacity outside 0 to 1 through onError and keeps the current opacity', () => {
      const onError = vi.fn();
      const { manager, map } = createManager({ onError });
      manager.addLayer(layer('layer-1', { opacity: 0.5 }));

      manager.setOpacity('layer-1', 5);
      manager.setOpacity('layer-1', -1);
      manager.setOpacity('layer-1', Number.NaN);

      expect(onError.mock.calls.map(([error]) => error)).toEqual([
        new Error('Opacity 5 for layer layer-1 must be a number between 0 and 1. Opacity not set.'),
        new Error('Opacity -1 for layer layer-1 must be a number between 0 and 1. Opacity not set.'),
        new Error('Opacity NaN for layer layer-1 must be a number between 0 and 1. Opacity not set.'),
      ]);
      expect(map.layers.get('layer-1')).toMatchObject({ opacity: 0.5, computedOpacity: 0.5 });
    });

    it('reports an opacity outside 0 to 1 sent straight to a layer\'s actor through onError once and keeps the current opacity', () => {
      const onError = vi.fn();
      const { manager, map } = createManager({ onError });
      manager.addLayer(layer('layer-1', { opacity: 0.5 }));

      actorOf(manager, 'layer-1')?.send({ type: 'LAYER.SET_OPACITY', opacity: 5 });

      expect(onError.mock.calls.map(([error]) => error)).toEqual([
        new Error('Opacity 5 for layer layer-1 must be a number between 0 and 1. Opacity not set.'),
      ]);
      expect(map.layers.get('layer-1')).toMatchObject({ opacity: 0.5, computedOpacity: 0.5 });
    });

    it('reports a group opacity outside 0 to 1 through onError and keeps the opacity of the group and its layers', () => {
      const onError = vi.fn();
      const { manager, map } = createManager({ onError });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1', opacity: 0.5 }) });
      manager.addLayer(layer('layer-1', { parentId: 'group-1', opacity: 0.8 }));

      manager.setOpacity('group-1', 1.5);

      expect(onError).toHaveBeenCalledWith(new Error('Opacity 1.5 for layer group-1 must be a number between 0 and 1. Opacity not set.'));
      expect(map.layers.get('group-1')).toMatchObject({ opacity: 0.5, computedOpacity: 0.5 });
      expect(map.layers.get('layer-1')).toMatchObject({ opacity: 0.8, computedOpacity: 0.4 });
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

    it('reports no change when a layer is set to an equal single time', () => {
      const onTimeInfoChanged = vi.fn();
      const { manager } = createManager({ onTimeInfoChanged });
      manager.addLayer(layer('layer-1', { timeInfo: newYearsDay }));

      manager.setTimeInfo('layer-1', { type: 'single', precision: 'date', value: Temporal.ZonedDateTime.from('2024-01-01T00:00[UTC]') });

      expect(onTimeInfoChanged).not.toHaveBeenCalled();
    });

    it('reports no change when a layer is set to an equal date range', () => {
      const onTimeInfoChanged = vi.fn();
      const { manager } = createManager({ onTimeInfoChanged });
      manager.addLayer(layer('layer-1', {
        timeInfo: { type: 'range', precision: 'date', start: Temporal.PlainDate.from('2026-06-01'), end: Temporal.PlainDate.from('2026-08-31') },
      }));

      manager.setTimeInfo('layer-1', { type: 'range', precision: 'date', start: Temporal.PlainDate.from('2026-06-01'), end: Temporal.PlainDate.from('2026-08-31') });

      expect(onTimeInfoChanged).not.toHaveBeenCalled();
    });

    it('reports a layer\'s time info when the same day changes from a zoned date-time to a plain date', () => {
      const onTimeInfoChanged = vi.fn();
      const { manager } = createManager({ onTimeInfoChanged });
      manager.addLayer(layer('layer-1', { timeInfo: newYearsDay }));
      const plainNewYearsDay: SingleTimeInfo = { type: 'single', precision: 'date', value: Temporal.PlainDate.from('2024-01-01') };

      manager.setTimeInfo('layer-1', plainNewYearsDay);

      expect(onTimeInfoChanged).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'layer-1' }), plainNewYearsDay);
    });

    it('reports no change when a group is set to equal time info', () => {
      const onTimeInfoChanged = vi.fn();
      const { manager } = createManager({ onTimeInfoChanged });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1', timeInfo: newYearsDay }) });

      manager.setTimeInfo('group-1', { type: 'single', precision: 'date', value: Temporal.ZonedDateTime.from('2024-01-01T00:00[UTC]') });

      expect(onTimeInfoChanged).not.toHaveBeenCalled();
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
      const manager = new LayerManager<TestLayerData, { legend: string }>();
      const map = createMapModel<TestLayerData, { legend: string }>();
      manager.setAdapter(map);
      manager.addGroup({ layerConfig: { ...createTestLayerGroupConfig({ layerId: 'group-1' }), layerData: { legend: 'old' } } });

      manager.updateLayerData('group-1', { legend: 'new' });

      expect(map.layers.get('group-1')?.layerData).toEqual({ legend: 'new' });
    });
  });

  describe('removing layers', () => {
    it('removes a layer from the manager and the map and stops it', () => {
      const onLayerRemoved = vi.fn();
      const { manager, map } = createManager({ onLayerRemoved });
      manager.addLayer(layer('a'));
      manager.addLayer(layer('b'));
      const removed = actorOf(manager, 'a');

      manager.removeLayer('a');

      expect(onLayerRemoved).toHaveBeenCalledWith('a');
      expect(removed?.getSnapshot().status).toBe('stopped');
      expect(topLevelIds(manager)).toEqual(['b']);
      expect(manager.getTree().layers.a).toBeUndefined();
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

      expect(manager.getTree().rootIds).toEqual([]);
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
      expect(manager.getTree().layers.inner).toBeUndefined();
    });
  });

  describe('rejected changes', () => {
    it('reports adding a layer with an id that is already in use through onError', () => {
      const onError = vi.fn();
      const { manager } = createManager({ onError });
      manager.addLayer(layer('layer-1'));

      manager.addLayer(layer('layer-1'));

      expect(onError).toHaveBeenCalledWith(new Error('Layer with ID layer-1 already exists. Layer not added.'));
      expect(manager.getTree().rootIds).toHaveLength(1);
    });

    it('reports adding a layer to a parent that does not exist through onError', () => {
      const onError = vi.fn();
      const { manager } = createManager({ onError });

      manager.addLayer(layer('child-1', { parentId: 'missing-group' }));

      expect(onError).toHaveBeenCalledWith(new Error('Unable to find parent group missing-group. Layer child-1 not added.'));
      expect(manager.getTree().layers['child-1']).toBeUndefined();
    });

    it('reports adding a layer with an opacity outside 0 to 1 through onError', () => {
      const onError = vi.fn();
      const { manager, map } = createManager({ onError });

      manager.addLayer(layer('too-high', { opacity: 5 }));
      manager.addLayer(layer('too-low', { opacity: -1 }));
      manager.addLayer(layer('not-a-number', { opacity: Number.NaN }));

      expect(onError.mock.calls.map(([error]) => error)).toEqual([
        new Error('Opacity 5 for layer too-high must be a number between 0 and 1. Layer not added.'),
        new Error('Opacity -1 for layer too-low must be a number between 0 and 1. Layer not added.'),
        new Error('Opacity NaN for layer not-a-number must be a number between 0 and 1. Layer not added.'),
      ]);
      expect(manager.getTree().rootIds).toEqual([]);
      expect(map.layers.size).toBe(0);
    });

    it('reports adding a group with an opacity outside 0 to 1 through onError', () => {
      const onError = vi.fn();
      const { manager, map } = createManager({ onError });

      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1', opacity: 1.5 }) });

      expect(onError).toHaveBeenCalledWith(new Error('Opacity 1.5 for layer group-1 must be a number between 0 and 1. Layer not added.'));
      expect(manager.getTree().rootIds).toEqual([]);
      expect(map.layers.size).toBe(0);
    });

    it('reports removing a layer that does not exist through onError', () => {
      const onError = vi.fn();
      const { manager } = createManager({ onError });

      manager.removeLayer('missing-layer');

      expect(onError).toHaveBeenCalledWith(new Error('Unable to find layer missing-layer. Layer not removed.'));
    });

    it('reports changing a layer that does not exist through onError', () => {
      const onError = vi.fn();
      const { manager } = createManager({ onError });

      manager.setEnabled('missing-layer', true);
      manager.setEnabled('missing-layer', false);
      manager.showLayer('missing-layer');
      manager.setOpacity('missing-layer', 0.5);
      manager.setTimeInfo('missing-layer', newYearsDay);
      manager.updateLayerData('missing-layer', { test: 'updated' });

      expect(onError.mock.calls.map(([error]) => error)).toEqual([
        new Error('Unable to find layer missing-layer. Layer not switched on.'),
        new Error('Unable to find layer missing-layer. Layer not switched off.'),
        new Error('Unable to find layer missing-layer. Layer not shown.'),
        new Error('Unable to find layer missing-layer. Opacity not set.'),
        new Error('Unable to find layer missing-layer. Time info not set.'),
        new Error('Unable to find layer missing-layer. Layer data not updated.'),
      ]);
    });

    it('reports raising or lowering a layer that does not exist through onError', () => {
      const onError = vi.fn();
      const { manager } = createManager({ onError });

      manager.raiseLayer('missing-layer');
      manager.lowerLayer('missing-layer');

      expect(onError.mock.calls.map(([error]) => error)).toEqual([
        new Error('Unable to find layer missing-layer. Layer not moved.'),
        new Error('Unable to find layer missing-layer. Layer not moved.'),
      ]);
    });

    it('reports removing a group that still has children through onError', () => {
      const onError = vi.fn();
      const { manager } = createManager({ onError });
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('child-1', { parentId: 'group-1' }));

      manager.removeLayer('group-1');

      expect(onError).toHaveBeenCalledWith(new Error('Layer group group-1 has children. Layer not removed.'));
      expect(manager.getTree().layers['group-1']).toBeDefined();
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
      expect(manager.getTree().rootIds).toEqual([]);
      expect(map.layers.size).toBe(0);
    });

    it('stops every layer', () => {
      const { manager } = createManager();
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('layer-1'));
      const groupActor = actorOf(manager, 'group-1');
      const layerActor = actorOf(manager, 'layer-1');

      manager.reset();

      expect(groupActor?.getSnapshot().status).toBe('stopped');
      expect(layerActor?.getSnapshot().status).toBe('stopped');
    });

    it('accepts new layers with previously used ids', () => {
      const { manager } = createManager();
      manager.addLayer(layer('layer-1'));
      manager.reset();

      manager.addLayer(layer('layer-1'));

      expect(topLevelIds(manager)).toEqual(['layer-1']);
    });
  });

  describe('layer tree', () => {
    it('lists every layer and group, with the top level bottom first', () => {
      const { manager } = createManager();
      manager.addGroup(group('group-1'));
      manager.addLayer(layer('c1', { parentId: 'group-1' }));
      manager.addLayer({ ...layer('a'), position: 'top' });

      const tree = manager.getTree();

      expect(tree.rootIds).toEqual(['group-1', 'a']);
      expect(Object.keys(tree.layers).sort()).toEqual(['a', 'c1', 'group-1']);
      expect(tree.layers['group-1']).toMatchObject({ layerType: 'layerGroup', childIds: ['c1'] });
      expect(tree.layers.c1).toMatchObject({ layerType: 'layer', parentId: 'group-1' });
    });

    it('keeps the same tree until something changes, and the same info for each layer that did not change', () => {
      const { manager } = createManager();
      manager.addLayer(layer('a'));
      manager.addLayer(layer('b'));
      const before = manager.getTree();

      expect(manager.getTree()).toBe(before);

      manager.setOpacity('a', 0.5);
      const after = manager.getTree();

      expect(after).not.toBe(before);
      expect(after.layers.a).toMatchObject({ opacity: 0.5 });
      expect(after.layers.b).toBe(before.layers.b);
      expect(after.rootIds).toBe(before.rootIds);
    });

    it('calls a subscriber after each change until it unsubscribes', () => {
      const { manager } = createManager();
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);

      manager.addLayer(layer('a'));
      const callsWhileSubscribed = listener.mock.calls.length;
      unsubscribe();
      manager.setOpacity('a', 0.5);

      expect(callsWhileSubscribed).toBeGreaterThan(0);
      expect(listener).toHaveBeenCalledTimes(callsWhileSubscribed);
    });
  });

  describe('adapter', () => {
    it('types a drawing adapter\'s options with what it draws, so renderLayer and disposeLayer share one type', () => {
      const info: LayerInfo<TestLayerData> = {
        layerId: 'layer-1',
        layerName: 'Layer',
        layerType: 'layer',
        listMode: 'show',
        parentId: null,
        layerData: { test: 'sea-ice' },
        enabled: true,
        visible: true,
        opacity: 1,
        computedOpacity: 1,
      };
      const options: RenderAdapterOptions<TestLayerData, { name: string }, string> = {
        renderLayer: (layer, map, current) => current ?? `${map.name}:${layer.layerData.test}`,
        disposeLayer: vi.fn(),
      };

      expect(options.renderLayer?.(info, { name: 'polar' })).toBe('polar:sea-ice');
      expect(options.renderLayer?.(info, { name: 'polar' }, 'drawn')).toBe('drawn');
    });

    it('tells the adapter about a change before the options callback', () => {
      const calls: string[] = [];
      const manager = new LayerManager<TestLayerData>({ onVisibilityChanged: () => calls.push('options') });
      manager.setAdapter({ onVisibilityChanged: () => calls.push('adapter') });

      manager.addLayer({ ...layer('layer-1'), visible: true });

      expect(calls).toEqual(['adapter', 'options']);
    });

    it('accepts options and an adapter typed with only the layer data type', () => {
      const options: LayerManagerOptions<TestLayerData> = { onLayerAdded: vi.fn() };
      const adapter: LayerManagerAdapter<TestLayerData> = { onLayerAdded: vi.fn() };
      const manager = new LayerManager<TestLayerData>(options);

      manager.setAdapter(adapter);
      manager.addLayer(layer('layer-1'));

      expect(options.onLayerAdded).toHaveBeenCalledTimes(1);
      expect(adapter.onLayerAdded).toHaveBeenCalledTimes(1);
    });

    it('still calls the options callback when an adapter hook throws, and still reports the error', () => {
      vi.useFakeTimers();
      onTestFinished(() => {
        vi.useRealTimers();
      });
      const onVisibilityChanged = vi.fn();
      const manager = new LayerManager<TestLayerData>({ onVisibilityChanged });
      manager.setAdapter({
        onVisibilityChanged: () => {
          throw new Error('adapter failed');
        },
      });
      manager.addLayer(layer('layer-1'));

      manager.setEnabled('layer-1', true);

      expect(onVisibilityChanged).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'layer-1' }), true);
      expect(() => vi.runAllTimers()).toThrow('adapter failed');
    });

    it('unregisters the previous adapter when a new one is attached', () => {
      const { manager, map } = createManager();
      const next: LayerManagerAdapter<TestLayerData> = { register: vi.fn() };

      manager.setAdapter(next);

      expect(map.registered).toBe(false);
      expect(next.register).toHaveBeenCalledTimes(1);
    });

    it('shows the layers already added on a map attached afterwards', () => {
      const manager: TestManager = new LayerManager<TestLayerData>();
      manager.addGroup({ ...group('group-1'), visible: true });
      manager.addLayer({ ...layer('layer-1', { parentId: 'group-1' }), visible: true });
      manager.addLayer(layer('layer-2'));
      const map = createMapModel<TestLayerData>();

      manager.setAdapter(map);

      expect([...map.layers.keys()].sort()).toEqual(['group-1', 'layer-1', 'layer-2']);
      expect(map.visibleLayerIds()).toEqual(['group-1', 'layer-1']);
    });

    it('stacks a map attached afterwards in the manager\'s order', () => {
      const manager: TestManager = new LayerManager<TestLayerData>();
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
    });

    it('does nothing when the manager is destroyed a second time', () => {
      const { manager } = createManager();
      manager.destroy();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      onTestFinished(() => {
        warn.mockRestore();
      });

      manager.destroy();

      expect(warn).not.toHaveBeenCalled();
      expect(manager.destroyed).toBe(true);
    });

    it('reports attaching an adapter to a destroyed manager through onError and does not register it', () => {
      const onError = vi.fn();
      const { manager } = createManager({ onError });
      manager.destroy();
      const late: LayerManagerAdapter<TestLayerData> = { register: vi.fn() };

      manager.setAdapter(late);

      expect(onError).toHaveBeenCalledWith(new Error('The manager is destroyed. Adapter not attached.'));
      expect(late.register).not.toHaveBeenCalled();
    });
  });
});
