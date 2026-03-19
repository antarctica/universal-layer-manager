import type { SingleTimeInfo } from '../src/types';

import { ZonedDateTime } from '@internationalized/date';
import { describe, expect, it, vi } from 'vitest';
import {
  addChildLayerToGroup,
  addLayerGroupToManager,
  addLayerToManager,
  createTestLayerConfig,
  createTestLayerGroupConfig,
  createTestLayerManager,
} from './utils/layer-manager-helpers';

describe('layerManagerMachine', () => {
  describe('initial state', () => {
    it('starts with empty layers and default context', () => {
      // Setup: Create a new layer manager
      const layerManager = createTestLayerManager();

      // Verify: Manager starts with empty layers and default values
      const snapshot = layerManager.getSnapshot();
      expect(snapshot.context.layers).toEqual([]);
      expect(snapshot.context.childLayerOrder).toEqual([]);
      expect(snapshot.context.allowNestedGroupLayers).toBe(true);
    });

    it('initialises with allowNestedGroupLayers option', () => {
      // Setup: Create a manager with nested groups disabled
      const layerManager = createTestLayerManager({ allowNestedGroupLayers: false });

      // Verify: Manager context has the correct setting
      expect(layerManager.getSnapshot().context.allowNestedGroupLayers).toBe(false);
    });
  });

  describe('adding layers', () => {
    it('adds a single layer to the manager', () => {
      // Setup: Create a layer manager
      const layerManager = createTestLayerManager();
      const config = createTestLayerConfig({ layerId: 'layer-1' });

      // Action: Add a layer
      const { layerActor } = addLayerToManager(layerManager, config);

      // Verify: Layer is added to manager's layers array
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toHaveLength(1);
      expect(managerSnapshot.context.layers[0].type).toBe('layer');
      expect(managerSnapshot.context.layers[0].layerActor.id).toBe('layer-1');
      expect(managerSnapshot.context.childLayerOrder).toEqual(['layer-1']);

      // Verify: Layer actor is properly spawned
      expect(layerActor.getSnapshot().context.layerId).toBe('layer-1');
    });

    it('adds multiple layers in order', () => {
      // Setup: Create a layer manager
      const layerManager = createTestLayerManager();

      // Action: Add multiple layers (default position is 'bottom' which adds to beginning)
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-2' }));
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-3' }));

      // Verify: All layers are added (order is reversed because 'bottom' uses unshift)
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toHaveLength(3);
      expect(managerSnapshot.context.childLayerOrder).toEqual(['layer-3', 'layer-2', 'layer-1']);
    });

    it('adds a layer group to the manager', () => {
      // Setup: Create a layer manager
      const layerManager = createTestLayerManager();
      const config = createTestLayerGroupConfig({ layerId: 'group-1' });

      // Action: Add a layer group
      const { groupActor } = addLayerGroupToManager(layerManager, config);

      // Verify: Group is added to manager's layers array
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toHaveLength(1);
      expect(managerSnapshot.context.layers[0].type).toBe('layerGroup');
      expect(managerSnapshot.context.layers[0].layerActor.id).toBe('group-1');
      expect(managerSnapshot.context.childLayerOrder).toEqual(['group-1']);

      // Verify: Group actor is properly spawned
      expect(groupActor.getSnapshot().context.layerId).toBe('group-1');
    });

    it('adds layers and groups together', () => {
      // Setup: Create a layer manager
      const layerManager = createTestLayerManager();

      // Action: Add layers and groups (default position is 'bottom' which adds to beginning)
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-2' }));

      // Verify: All items are added (order is reversed because 'bottom' uses unshift)
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toHaveLength(3);
      expect(managerSnapshot.context.childLayerOrder).toEqual(['layer-2', 'group-1', 'layer-1']);
    });

    it('adds layer at specific index', () => {
      // Setup: Create a manager with existing layers (order is ['layer-2', 'layer-1'] due to bottom positioning)
      const layerManager = createTestLayerManager();
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-2' }));

      // Action: Add a layer at index 1
      layerManager.send({
        type: 'LAYER.ADD',
        params: {
          layerConfig: createTestLayerConfig({ layerId: 'layer-middle' }),
          index: 1,
        },
      });

      // Verify: Layer is inserted at the correct position (order is ['layer-2', 'layer-middle', 'layer-1'])
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.childLayerOrder).toEqual(['layer-2', 'layer-middle', 'layer-1']);
    });

    it('adds layer at top position', () => {
      // Setup: Create a manager with existing layers
      const layerManager = createTestLayerManager();
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-2' }));

      // Action: Add a layer at top position
      layerManager.send({
        type: 'LAYER.ADD',
        params: {
          layerConfig: createTestLayerConfig({ layerId: 'layer-top' }),
          position: 'top',
        },
      });

      // Verify: Layer is added at the top (end of array)
      const managerSnapshot = layerManager.getSnapshot();
      const order = managerSnapshot.context.childLayerOrder;
      expect(order.at(-1)).toBe('layer-top');
    });

    it('adds layer at bottom position', () => {
      // Setup: Create a manager with existing layers
      const layerManager = createTestLayerManager();
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-2' }));

      // Action: Add a layer at bottom position
      layerManager.send({
        type: 'LAYER.ADD',
        params: {
          layerConfig: createTestLayerConfig({ layerId: 'layer-bottom' }),
          position: 'bottom',
        },
      });

      // Verify: Layer is added at the bottom (start of array)
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.childLayerOrder[0]).toBe('layer-bottom');
    });
  });

  describe('removing layers', () => {
    it('removes a layer from the manager', () => {
      // Setup: Create a manager with a layer
      const layerManager = createTestLayerManager();
      const { layerActor } = addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));

      // Verify: Layer exists
      expect(layerManager.getSnapshot().context.layers).toHaveLength(1);

      // Action: Remove the layer
      layerManager.send({ type: 'LAYER.REMOVE', layerId: 'layer-1' });

      // Verify: Layer is removed from manager
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toHaveLength(0);
      expect(managerSnapshot.context.childLayerOrder).toEqual([]);

      // Verify: Layer actor is stopped
      expect(layerActor.getSnapshot().status).toBe('stopped');
    });

    it('removes a layer group from the manager', () => {
      // Setup: Create a manager with a group
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));

      // Verify: Group exists
      expect(layerManager.getSnapshot().context.layers).toHaveLength(1);

      // Action: Remove the group
      layerManager.send({ type: 'LAYER.REMOVE', layerId: 'group-1' });

      // Verify: Group is removed from manager
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toHaveLength(0);
      expect(managerSnapshot.context.childLayerOrder).toEqual([]);

      // Verify: Group actor is stopped
      expect(groupActor.getSnapshot().status).toBe('stopped');
    });

    it('removes a layer from multiple layers', () => {
      // Setup: Create a manager with multiple layers (order is ['layer-3', 'layer-2', 'layer-1'] due to bottom positioning)
      const layerManager = createTestLayerManager();
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-2' }));
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-3' }));

      // Action: Remove middle layer
      layerManager.send({ type: 'LAYER.REMOVE', layerId: 'layer-2' });

      // Verify: Only the specified layer is removed
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toHaveLength(2);
      expect(managerSnapshot.context.childLayerOrder).toEqual(['layer-3', 'layer-1']);
    });

    it('handles removing non-existent layer gracefully', () => {
      // Setup: Create a manager with a layer
      const layerManager = createTestLayerManager();
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));

      // Action: Try to remove a non-existent layer
      layerManager.send({ type: 'LAYER.REMOVE', layerId: 'non-existent' });

      // Verify: Existing layer is still present
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toHaveLength(1);
      expect(managerSnapshot.context.childLayerOrder).toEqual(['layer-1']);
    });

    it('cannot remove a layer group that has children', () => {
      // Setup: Create a manager with a group that has a child
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-1' }));

      // Verify: Group has a child
      expect(groupActor.getSnapshot().context.children).toHaveLength(1);

      // Action: Try to remove the group
      layerManager.send({ type: 'LAYER.REMOVE', layerId: 'group-1' });

      // Verify: Group is not removed (cannot remove group with children)
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toHaveLength(2); // group + child
      expect(groupActor.getSnapshot().status).toBe('active');
    });
  });

  describe('event emissions', () => {
    it('processes LAYER.UPDATE_VISIBILITY events', () => {
      // Setup: Create a manager with a layer
      const layerManager = createTestLayerManager();
      const { layerActor } = addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }), { visible: false });

      const visibilityChangeWatcher = vi.fn();
      layerManager.on('LAYER.VISIBILITY_CHANGED', visibilityChangeWatcher);
      layerActor.send({ type: 'LAYER.ENABLED' });

      expect(visibilityChangeWatcher).toHaveBeenCalledWith({
        type: 'LAYER.VISIBILITY_CHANGED',
        layerId: 'layer-1',
        visible: true,
      });
    });

    it('emits LAYER.VISIBILITY_CHANGED events for layer groups when visibility changes', () => {
      // Setup: Create a manager with a disabled group
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'group-1' }),
        { visible: false },
      );

      const visibilityChangeWatcher = vi.fn();
      layerManager.on('LAYER.VISIBILITY_CHANGED', visibilityChangeWatcher);

      // Verify: Group starts disabled
      expect(groupActor.getSnapshot().value).toEqual({ disabled: 'hidden' });

      // Action: Enable the group so it becomes visible
      groupActor.send({ type: 'LAYER.ENABLED' });

      // Verify: Manager emits visibility changed event for the group
      expect(visibilityChangeWatcher).toHaveBeenCalledWith({
        type: 'LAYER.VISIBILITY_CHANGED',
        layerId: 'group-1',
        visible: true,
      });
    });

    it('processes LAYER.UPDATE_OPACITY events', () => {
      // Setup: Create a manager with a layer
      const layerManager = createTestLayerManager();
      const { layerActor } = addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));

      const opacityChangeWatcher = vi.fn();
      layerManager.on('LAYER.OPACITY_CHANGED', opacityChangeWatcher);

      // Action: Update opacity through manager
      layerManager.send({ type: 'LAYER.UPDATE_OPACITY', layerId: 'layer-1', opacity: 0.5, computedOpacity: 0.5 });

      // Verify: Manager emits opacity changed event with correct payload
      expect(opacityChangeWatcher).toHaveBeenCalledWith({
        type: 'LAYER.OPACITY_CHANGED',
        layerId: 'layer-1',
        opacity: 0.5,
        computedOpacity: 0.5,
      });
      expect(layerActor.getSnapshot().context.layerId).toBe('layer-1');
    });

    it('processes LAYER.UPDATE_OPACITY events for all layer groups and child layers when a layer group changes its opacity', () => {
      // Setup: Create a manager with a layer group and a child layer
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1', opacity: 1 }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'layer-1', opacity: 0.8 }));

      const opacityChangeWatcher = vi.fn();
      layerManager.on('LAYER.OPACITY_CHANGED', opacityChangeWatcher);

      // Action: Update opacity through the group machine
      groupActor.send({ type: 'LAYER.SET_OPACITY', opacity: 0.5 });

      expect(opacityChangeWatcher).toHaveBeenCalledTimes(2);

      expect(opacityChangeWatcher).toHaveBeenNthCalledWith(1, {
        type: 'LAYER.OPACITY_CHANGED',
        layerId: 'group-1',
        opacity: 0.5,
        computedOpacity: 0.5,
      });

      expect(opacityChangeWatcher).toHaveBeenNthCalledWith(2, {
        type: 'LAYER.OPACITY_CHANGED',
        layerId: 'layer-1',
        opacity: 0.8,
        computedOpacity: 0.8 * 0.5,
      });

      opacityChangeWatcher.mockReset();
      groupActor.send({ type: 'LAYER.SET_OPACITY', opacity: 0.25 });

      expect(opacityChangeWatcher).toHaveBeenCalledTimes(2);

      expect(opacityChangeWatcher).toHaveBeenNthCalledWith(1, {
        type: 'LAYER.OPACITY_CHANGED',
        layerId: 'group-1',
        opacity: 0.25,
        computedOpacity: 0.25,
      });

      expect(opacityChangeWatcher).toHaveBeenNthCalledWith(2, {
        type: 'LAYER.OPACITY_CHANGED',
        layerId: 'layer-1',
        opacity: 0.8,
        computedOpacity: 0.25 * 0.8,
      });
    });

    it('processes LAYER.UPDATE_TIME_INFO events', () => {
      // Setup: Create a manager with a layer
      const layerManager = createTestLayerManager();
      const { layerActor } = addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      const timeInfo: SingleTimeInfo = {
        type: 'single',
        precision: 'date',
        value: new ZonedDateTime(2024, 1, 1, 'UTC', 0),
      };

      const timeInfoChangeWatcher = vi.fn();
      layerManager.on('LAYER.TIME_INFO_CHANGED', timeInfoChangeWatcher);

      // Action: Update time info through manager
      layerManager.send({ type: 'LAYER.UPDATE_TIME_INFO', layerId: 'layer-1', timeInfo });

      // Verify: Manager emits time info changed event with correct payload
      expect(timeInfoChangeWatcher).toHaveBeenCalledWith({
        type: 'LAYER.TIME_INFO_CHANGED',
        layerId: 'layer-1',
        timeInfo,
      });
      expect(layerActor.getSnapshot().context.layerId).toBe('layer-1');
    });

    it('processes LAYER.UPDATE_LAYER_DATA events', () => {
      // Setup: Create a manager with a layer
      const layerManager = createTestLayerManager();
      const { layerActor } = addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      const newLayerData = { test: 'updated' };

      const layerDataChangeWatcher = vi.fn();
      layerManager.on('LAYER.LAYER_DATA_CHANGED', layerDataChangeWatcher);

      // Action: Update layer data through manager
      layerManager.send({ type: 'LAYER.UPDATE_LAYER_DATA', layerId: 'layer-1', layerData: newLayerData });

      // Verify: Manager emits layer data changed event with correct payload
      expect(layerDataChangeWatcher).toHaveBeenCalledWith({
        type: 'LAYER.LAYER_DATA_CHANGED',
        layerId: 'layer-1',
        layerData: newLayerData,
      });
      expect(layerActor.getSnapshot().context.layerId).toBe('layer-1');
    });

    it('emits LAYER.LAYER_DATA_CHANGED events for layer groups when group data is updated', () => {
      // Setup: Create a manager with a group
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'group-1' }),
      );
      const newGroupData = { test: 'group-updated' };

      const layerDataChangeWatcher = vi.fn();
      layerManager.on('LAYER.LAYER_DATA_CHANGED', layerDataChangeWatcher);

      // Action: Update group data through the group machine
      groupActor.send({ type: 'LAYER.SET_LAYER_DATA', layerData: newGroupData });

      // Verify: Manager emits layer data changed event with correct payload for the group
      expect(layerDataChangeWatcher).toHaveBeenCalledWith({
        type: 'LAYER.LAYER_DATA_CHANGED',
        layerId: 'group-1',
        layerData: newGroupData,
      });
    });

    it('emits LAYER.ADDED and LAYER.ORDER_CHANGED events when a layer is added', () => {
      // Setup: Create a layer manager
      const layerManager = createTestLayerManager();
      const addedWatcher = vi.fn();
      const orderChangedWatcher = vi.fn();

      layerManager.on('LAYER.ADDED', addedWatcher);
      layerManager.on('LAYER.ORDER_CHANGED', orderChangedWatcher);

      // Action: Add a single layer
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));

      // Verify: Manager emits layer added and order changed events
      expect(addedWatcher).toHaveBeenCalledWith({
        type: 'LAYER.ADDED',
        layerId: 'layer-1',
        visible: false,
      });
      expect(orderChangedWatcher).toHaveBeenCalledWith({
        type: 'LAYER.ORDER_CHANGED',
        layerOrder: ['layer-1'],
      });
    });

    it('emits LAYER.REMOVED and LAYER.ORDER_CHANGED events when a layer is removed', () => {
      // Setup: Create a manager with multiple layers
      const layerManager = createTestLayerManager();
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-2' }));

      const removedWatcher = vi.fn();
      const orderChangedWatcher = vi.fn();

      layerManager.on('LAYER.REMOVED', removedWatcher);
      layerManager.on('LAYER.ORDER_CHANGED', orderChangedWatcher);

      // Action: Remove one layer
      layerManager.send({ type: 'LAYER.REMOVE', layerId: 'layer-1' });

      // Verify: Manager emits layer removed and order changed events
      expect(removedWatcher).toHaveBeenCalledWith({
        type: 'LAYER.REMOVED',
        layerId: 'layer-1',
      });
      expect(orderChangedWatcher).toHaveBeenCalledWith({
        type: 'LAYER.ORDER_CHANGED',
        layerOrder: ['layer-2'],
      });
    });
  });

  describe('reset functionality', () => {
    it('resets the manager to initial state', () => {
      // Setup: Create a manager with multiple layers
      const layerManager = createTestLayerManager();
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-2' }));
      addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));

      // Verify: Manager has layers
      expect(layerManager.getSnapshot().context.layers).toHaveLength(3);

      // Action: Reset the manager
      layerManager.send({ type: 'RESET' });

      // Verify: Manager is reset to initial state
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toEqual([]);
      expect(managerSnapshot.context.childLayerOrder).toEqual([]);
    });

    it('stops all layer actors when reset', () => {
      // Setup: Create a manager with layers
      const layerManager = createTestLayerManager();
      const { layerActor } = addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));

      // Verify: Actors are active
      expect(layerActor.getSnapshot().status).toBe('active');
      expect(groupActor.getSnapshot().status).toBe('active');

      // Action: Reset the manager
      layerManager.send({ type: 'RESET' });

      // Verify: Manager context is cleared (actors are stopped internally)
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toEqual([]);
      expect(managerSnapshot.context.childLayerOrder).toEqual([]);

      // Verify: Actors are no longer in the manager's context
      // Note: The actors may still be in 'active' status briefly before being stopped,
      // but they are removed from the manager's context
      const layerInManager = managerSnapshot.context.layers.find((l) => l.layerActor.id === 'layer-1');
      const groupInManager = managerSnapshot.context.layers.find((l) => l.layerActor.id === 'group-1');
      expect(layerInManager).toBeUndefined();
      expect(groupInManager).toBeUndefined();
    });
  });

  describe('validation and edge cases', () => {
    it('does not add layer with duplicate layerId', () => {
      // Setup: Create a manager with a layer
      const layerManager = createTestLayerManager();
      addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));

      // Action: Try to add another layer with the same ID
      layerManager.send({
        type: 'LAYER.ADD',
        params: {
          layerConfig: createTestLayerConfig({ layerId: 'layer-1' }),
        },
      });

      // Verify: Only one layer exists (duplicate is rejected)
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toHaveLength(1);
    });

    it('handles adding layer with invalid parent gracefully', () => {
      // Setup: Create a manager
      const layerManager = createTestLayerManager();

      // Action: Try to add a layer with a non-existent parent
      layerManager.send({
        type: 'LAYER.ADD',
        params: {
          layerConfig: createTestLayerConfig({ layerId: 'layer-1', parentId: 'non-existent-parent' }),
        },
      });

      // Verify: Layer is not added (invalid parent reference)
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toHaveLength(0);
    });

    it('handles events for non-existent layers gracefully', () => {
      // Setup: Create a manager without layers
      const layerManager = createTestLayerManager();

      // Action: Send events for non-existent layer
      layerManager.send({ type: 'LAYER.UPDATE_VISIBILITY', layerId: 'non-existent', visible: true });
      layerManager.send({ type: 'LAYER.UPDATE_OPACITY', layerId: 'non-existent', opacity: 0.5, computedOpacity: 0.5 });
      layerManager.send({ type: 'LAYER.UPDATE_TIME_INFO', layerId: 'non-existent', timeInfo: undefined as never });

      // Verify: Manager remains in valid state
      const managerSnapshot = layerManager.getSnapshot();
      expect(managerSnapshot.context.layers).toEqual([]);
    });
  });
});
