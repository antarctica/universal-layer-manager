import type { SingleTimeInfo } from '../src/types';
import type { TestLayerData } from './utils/layer-manager-helpers';

import { Temporal } from 'temporal-polyfill';
import { describe, expect, it, vi } from 'vitest';
import { transition } from 'xstate';
import { createLayerManagerMachine } from '../src/layerManagerMachines/layerManagerMachine';
import {
  addChildLayerToGroup,
  addLayerGroupToManager,
  addLayerToManager,
  createTestLayerConfig,
  createTestLayerGroupConfig,
  createTestLayerManager,
} from './utils/layer-manager-helpers';

// The event contract for consumers that drive the manager machine directly.
// Behaviour reachable through LayerManager is specified in LayerManager.test.ts.
describe('layerManagerMachine', () => {
  describe('emitted events', () => {
    it('emits LAYER.ADDED with the visibility the layer has once added', () => {
      const layerManager = createTestLayerManager();
      const addedWatcher = vi.fn();
      layerManager.on('LAYER.ADDED', addedWatcher);

      layerManager.send({ type: 'LAYER.ADD', params: { layerConfig: createTestLayerConfig({ layerId: 'hidden-layer' }) } });
      layerManager.send({ type: 'LAYER.ADD', params: { layerConfig: createTestLayerConfig({ layerId: 'shown-layer' }), enabled: true } });

      expect(addedWatcher.mock.calls.map(([event]) => event)).toEqual([
        { type: 'LAYER.ADDED', layerId: 'hidden-layer', visible: false },
        { type: 'LAYER.ADDED', layerId: 'shown-layer', visible: true },
      ]);
    });

    it('emits LAYER.REMOVED when a layer is removed', () => {
      const layerManager = createTestLayerManager();
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      const removedWatcher = vi.fn();
      layerManager.on('LAYER.REMOVED', removedWatcher);

      layerManager.send({ type: 'LAYER.REMOVE', layerId: 'layer-1' });

      expect(removedWatcher).toHaveBeenCalledWith({ type: 'LAYER.REMOVED', layerId: 'layer-1' });
    });

    it('emits a change event when a layer is switched on and shown, faded, dated or given new data', () => {
      const layerManager = createTestLayerManager();
      const { layerActor } = addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      const timeInfo: SingleTimeInfo = { type: 'single', precision: 'date', value: Temporal.ZonedDateTime.from('2024-01-01T00:00[UTC]') };
      const emittedWatcher = vi.fn();
      layerManager.on('*', emittedWatcher);

      layerActor.send({ type: 'LAYER.ENABLED' });
      layerActor.send({ type: 'LAYER.SET_OPACITY', opacity: 0.5 });
      layerActor.send({ type: 'LAYER.SET_TIME_INFO', timeInfo });
      layerActor.send({ type: 'LAYER.SET_LAYER_DATA', layerData: { test: 'updated' } });

      expect(emittedWatcher.mock.calls.map(([event]) => event)).toEqual([
        { type: 'LAYER.ENABLED_CHANGED', layerId: 'layer-1', enabled: true },
        { type: 'LAYER.VISIBILITY_CHANGED', layerId: 'layer-1', visible: true },
        { type: 'LAYER.OPACITY_CHANGED', layerId: 'layer-1', opacity: 0.5, computedOpacity: 0.5 },
        { type: 'LAYER.TIME_INFO_CHANGED', layerId: 'layer-1', timeInfo },
        { type: 'LAYER.LAYER_DATA_CHANGED', layerId: 'layer-1', layerData: { test: 'updated' } },
      ]);
    });

    it('emits change events only for layers it manages', () => {
      const layerManager = createTestLayerManager();
      const emittedWatcher = vi.fn();
      layerManager.on('*', emittedWatcher);
      const timeInfo: SingleTimeInfo = { type: 'single', precision: 'date', value: Temporal.ZonedDateTime.from('2024-01-01T00:00[UTC]') };

      layerManager.send({ type: 'CHILD.VISIBILITY_CHANGED', layerId: 'non-existent', visible: true });
      layerManager.send({ type: 'CHILD.ENABLED_CHANGED', layerId: 'non-existent', enabled: true });
      layerManager.send({ type: 'CHILD.OPACITY_CHANGED', layerId: 'non-existent', opacity: 0.5, computedOpacity: 0.5 });
      layerManager.send({ type: 'CHILD.TIME_INFO_CHANGED', layerId: 'non-existent', timeInfo });
      layerManager.send({ type: 'CHILD.LAYER_DATA_CHANGED', layerId: 'non-existent', layerData: { test: 'data' } });

      expect(emittedWatcher).not.toHaveBeenCalled();
    });
  });

  describe('layer order', () => {
    it('emits LAYER.ORDER_CHANGED with layers added to a group in their position', () => {
      const layerManager = createTestLayerManager();
      const orders: string[][] = [];
      layerManager.on('LAYER.ORDER_CHANGED', (event) => orders.push(event.layerOrder));

      addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-2' }));
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));

      expect(orders).toEqual([
        ['group-1'],
        ['group-1', 'child-1'],
        ['group-1', 'child-2', 'child-1'],
        ['layer-1', 'group-1', 'child-2', 'child-1'],
      ]);
    });

    it('emits LAYER.ORDER_CHANGED without a removed layer', () => {
      const layerManager = createTestLayerManager();
      addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-2' }));
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      const orders: string[][] = [];
      layerManager.on('LAYER.ORDER_CHANGED', (event) => orders.push(event.layerOrder));

      layerManager.send({ type: 'LAYER.REMOVE', layerId: 'child-1' });
      layerManager.send({ type: 'LAYER.REMOVE', layerId: 'layer-1' });

      expect(orders).toEqual([
        ['layer-1', 'group-1', 'child-2'],
        ['group-1', 'child-2'],
      ]);
    });
  });

  describe('moving layers', () => {
    it('emits LAYER.ORDER_CHANGED with the new order, then LAYER.MOVED with the layer and its parent', () => {
      const layerManager = createTestLayerManager();
      addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-1' }), { position: 'top' });
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-2' }), { position: 'top' });
      const emittedWatcher = vi.fn();
      layerManager.on('*', emittedWatcher);

      layerManager.send({ type: 'LAYER.MOVE', layerId: 'child-1', parentId: 'group-1', position: 'top' });

      expect(emittedWatcher.mock.calls.map(([event]) => event)).toEqual([
        { type: 'LAYER.ORDER_CHANGED', layerOrder: ['group-1', 'child-2', 'child-1'] },
        { type: 'LAYER.MOVED', layerId: 'child-1', parentId: 'group-1' },
      ]);
    });
  });

  describe('rejected changes', () => {
    it('emits LAYER.REJECTED and no LAYER.ORDER_CHANGED for a rejected add or remove', () => {
      const layerManager = createTestLayerManager();
      const orderChangedWatcher = vi.fn();
      const rejectedWatcher = vi.fn();
      layerManager.on('LAYER.ORDER_CHANGED', orderChangedWatcher);
      layerManager.on('LAYER.REJECTED', rejectedWatcher);

      layerManager.send({ type: 'LAYER.ADD', params: { layerConfig: createTestLayerConfig({ layerId: 'child-1', parentId: 'missing-group' }) } });
      layerManager.send({ type: 'LAYER.REMOVE', layerId: 'missing-layer' });

      expect(rejectedWatcher.mock.calls.map(([event]) => event)).toEqual([
        { type: 'LAYER.REJECTED', layerId: 'child-1', reason: 'Unable to find parent group missing-group. Layer child-1 not added.' },
        { type: 'LAYER.REJECTED', layerId: 'missing-layer', reason: 'Unable to find layer missing-layer. Layer not removed.' },
      ]);
      expect(orderChangedWatcher).not.toHaveBeenCalled();
    });
  });

  describe('pure transitions', () => {
    it('updates the parent group of a removed layer only when the removal is executed', () => {
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-1' }));
      const childIds = () => groupActor.getSnapshot().context.children.map((child) => child.id);

      transition(createLayerManagerMachine<TestLayerData>(), layerManager.getSnapshot(), { type: 'LAYER.REMOVE', layerId: 'child-1' });
      expect(childIds()).toEqual(['child-1']);

      layerManager.send({ type: 'LAYER.REMOVE', layerId: 'child-1' });
      expect(childIds()).toEqual([]);
    });

    it('updates the parent group of an added layer only when the addition is executed', () => {
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));
      const addChild = { type: 'LAYER.ADD', params: { layerConfig: createTestLayerConfig({ layerId: 'child-1', parentId: 'group-1' }) } } as const;
      const childIds = () => groupActor.getSnapshot().context.children.map((child) => child.id);

      transition(createLayerManagerMachine<TestLayerData>(), layerManager.getSnapshot(), addChild);
      expect(childIds()).toEqual([]);

      layerManager.send(addChild);
      expect(childIds()).toEqual(['child-1']);
    });

    it('updates the group of a moved layer only when the move is executed', () => {
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-1' }), { position: 'top' });
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-2' }), { position: 'top' });
      const moveChild = { type: 'LAYER.MOVE', layerId: 'child-1', parentId: 'group-1', position: 'top' } as const;
      const childOrder = () => groupActor.getSnapshot().context.childLayerOrder;

      transition(createLayerManagerMachine<TestLayerData>(), layerManager.getSnapshot(), moveChild);
      expect(childOrder()).toEqual(['child-1', 'child-2']);

      layerManager.send(moveChild);
      expect(childOrder()).toEqual(['child-2', 'child-1']);
    });

    it('updates both groups and the moved layer only when a move between groups is executed', () => {
      const layerManager = createTestLayerManager();
      const { groupActor: oldGroup } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));
      const { groupActor: newGroup } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-2' }));
      const { childActor } = addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-1' }));
      const moveChild = { type: 'LAYER.MOVE', layerId: 'child-1', parentId: 'group-2' } as const;
      const placement = () => ({
        oldGroup: oldGroup.getSnapshot().context.childLayerOrder,
        newGroup: newGroup.getSnapshot().context.childLayerOrder,
        parent: childActor.getSnapshot().context.parentRef?.id,
      });

      transition(createLayerManagerMachine<TestLayerData>(), layerManager.getSnapshot(), moveChild);
      expect(placement()).toEqual({ oldGroup: ['child-1'], newGroup: [], parent: 'group-1' });

      layerManager.send(moveChild);
      expect(placement()).toEqual({ oldGroup: [], newGroup: ['child-1'], parent: 'group-2' });
    });
  });
});
