import type { SingleTimeInfo } from '../src/types';

import { ZonedDateTime } from '@internationalized/date';
import { describe, expect, it, vi } from 'vitest';
import {
  addChildLayerToGroup,
  addLayerGroupToManager,
  createTestLayerConfig,
  createTestLayerGroupConfig,
  createTestLayerManager,
} from './utils/layer-manager-helpers';

describe('layerGroupMachine', () => {
  describe('initial state', () => {
    it('initial config matches the input config', () => {
      // Setup: Create a layer group that is not visible
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig(), { visible: true });

      // Verify: Group starts in disabled/hidden state with values from the input config
      const snapshot = groupActor.getSnapshot();
      expect(snapshot.context.layerId).toBe('group-1');
      expect(snapshot.context.layerName).toBe('Test group');
      expect(snapshot.context.listMode).toBe('show');
      expect(snapshot.context.opacity).toBe(1);
      expect(snapshot.context.layerType).toBe('layerGroup');
      expect(snapshot.context.children).toEqual([]);
      expect(snapshot.context.childLayerOrder).toEqual([]);

      expect(snapshot.matches({ enabled: 'visible' })).toBe(true);
    });

    it('initializes with custom opacity', () => {
      // Setup: Create a layer group with custom opacity
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ opacity: 0.5 }));

      // Verify: Group context has the custom opacity
      expect(groupActor.getSnapshot().context.opacity).toBe(0.5);
    });

    it('initializes with custom layer data', () => {
      // Setup: Create a layer group with custom layer data
      const customData = { test: 'custom-group' };
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerData: customData }));

      // Verify: Group context contains the custom data
      expect(groupActor.getSnapshot().context.layerData).toEqual(customData);
    });

    it('initializes with time info', () => {
      // Setup: Create a layer group with time information
      const timeInfo: SingleTimeInfo = {
        type: 'single',
        precision: 'date',
        value: new ZonedDateTime(2024, 1, 1, 'UTC', 0),
      };
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ timeInfo }));

      // Verify: Group context contains the time info
      expect(groupActor.getSnapshot().context.timeInfo).toEqual(timeInfo);
    });
  });

  describe('adding child layers', () => {
    it('adds a single child layer to a group', () => {
      // Setup: Create a layer group
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));

      const layerAddedWatcher = vi.fn();
      layerManager.on('LAYER.ADDED', layerAddedWatcher);

      // Action: Add a child layer
      const { childActor } = addChildLayerToGroup(
        layerManager,
        'group-1',
        createTestLayerConfig({ layerId: 'child-1', layerName: 'Child layer' }),
      );

      // Verify: Child is added to group's children array
      const groupSnapshot = groupActor.getSnapshot();
      expect(groupSnapshot.context.children).toHaveLength(1);
      expect(groupSnapshot.context.children[0].id).toBe('child-1');
      expect(groupSnapshot.context.childLayerOrder).toEqual(['child-1']);

      // Verify: Child layer has correct parent reference
      const childSnapshot = childActor.getSnapshot();
      expect(childSnapshot.context.parentRef).toBeDefined();

      // Verify: Manager emits LAYER.ADDED event
      expect(layerAddedWatcher).toHaveBeenCalledWith({
        type: 'LAYER.ADDED',
        layerId: 'child-1',
        visible: false,
      });
    });

    it('adds multiple child layers in order', () => {
      // Setup: Create a layer group
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));

      // Action: Add multiple child layers (default position is 'bottom' which adds to beginning)
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-2' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-3' }));

      // Verify: All children are added (order is reversed because 'bottom' uses unshift)
      const groupSnapshot = groupActor.getSnapshot();
      expect(groupSnapshot.context.children).toHaveLength(3);
      expect(groupSnapshot.context.childLayerOrder).toEqual(['child-3', 'child-2', 'child-1']);
    });

    it('adds child layer at specific index', () => {
      // Setup: Create a group with existing children
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-2' }));

      // Action: Add a child at index 1
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-middle' }), { index: 1 });

      // Verify: Child is inserted at the correct position (order is ['child-2', 'child-1'] initially, then middle at index 1)
      const groupSnapshot = groupActor.getSnapshot();
      expect(groupSnapshot.context.childLayerOrder).toEqual(['child-2', 'child-middle', 'child-1']);
    });

    it('adds child layer at top position', () => {
      // Setup: Create a group with existing children
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-2' }));

      // Action: Add a child at top position (top = end of array)
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-top' }), { position: 'top' });

      // Verify: Child is added at the top (end of array)
      const groupSnapshot = groupActor.getSnapshot();
      const order = groupSnapshot.context.childLayerOrder;
      expect(order[order.length - 1]).toBe('child-top');
    });

    it('adds child layer at bottom position', () => {
      // Setup: Create a group with existing children
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-1' }));
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-2' }));

      // Action: Add a child at bottom position (bottom = start of array)
      addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-bottom' }), {
        position: 'bottom',
      });

      // Verify: Child is added at the bottom (start of array)
      const groupSnapshot = groupActor.getSnapshot();
      expect(groupSnapshot.context.childLayerOrder[0]).toBe('child-bottom');
    });
  });

  describe('visibility cascading interactions', () => {
    it('when a child is added with visible:true, the group becomes visible', () => {
      // Setup: Create a disabled group with a child that will be enabled
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }), {
        visible: false,
      });

      // Verify: Group starts disabled
      expect(groupActor.getSnapshot().value).toEqual({ disabled: 'hidden' });

      const { childActor } = addChildLayerToGroup(
        layerManager,
        'group-1',
        createTestLayerConfig({ layerId: 'child-1' }),
        { visible: true },
      );

      // Verify: Child becomes enabled:visible when added with visible:true
      expect(childActor.getSnapshot().value).toEqual({ enabled: 'visible' });

      // Verify: Group becomes visible
      expect(groupActor.getSnapshot().value).toEqual({ enabled: 'visible' });
    });

    it('when a child is added with visible:false, the group remains disabled', () => {
      // Setup: Create a disabled group with a child that will be enabled
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }), {
        visible: false,
      });

      // Verify: Group starts disabled
      expect(groupActor.getSnapshot().value).toEqual({ disabled: 'hidden' });

      const { childActor } = addChildLayerToGroup(
        layerManager,
        'group-1',
        createTestLayerConfig({ layerId: 'child-1' }),
        { visible: false },
      );

      // Verify: Child becomes disabled:hidden when added with visible:false
      expect(childActor.getSnapshot().value).toEqual({ disabled: 'hidden' });

      // Verify: Group remains disabled
      expect(groupActor.getSnapshot().value).toEqual({ disabled: 'hidden' });
    });

    it('group visibility cascades to children when group is disabled or enabled', () => {
      // Setup: Create an enabled group with multiple children
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }), {
        visible: true,
      });
      const { childActor: child1 } = addChildLayerToGroup(
        layerManager,
        'group-1',
        createTestLayerConfig({ layerId: 'child-1' }),
        { visible: true },
      );
      const { childActor: child2 } = addChildLayerToGroup(
        layerManager,
        'group-1',
        createTestLayerConfig({ layerId: 'child-2' }),
        { visible: true },
      );

      // Verify: All are visible initially
      expect(groupActor.getSnapshot().value).toEqual({ enabled: 'visible' });
      expect(child1.getSnapshot().value).toEqual({ enabled: 'visible' });
      expect(child2.getSnapshot().value).toEqual({ enabled: 'visible' });

      // Action: Disable the group
      groupActor.send({ type: 'LAYER.DISABLED' });

      // Verify: Group becomes disabled, children become hidden (but remain enabled)
      expect(groupActor.getSnapshot().value).toEqual({ disabled: 'hidden' });
      expect(child1.getSnapshot().value).toEqual({ enabled: 'hidden' });
      expect(child2.getSnapshot().value).toEqual({ enabled: 'hidden' });

      // Action: Re-enable the group
      groupActor.send({ type: 'LAYER.ENABLED' });

      // Verify: Group becomes visible, children become visible
      expect(groupActor.getSnapshot().value).toEqual({ enabled: 'visible' });
      expect(child1.getSnapshot().value).toEqual({ enabled: 'visible' });
      expect(child2.getSnapshot().value).toEqual({ enabled: 'visible' });
    });

    it('cascades visibility through nested groups', () => {
      // Setup: Create a parent group with a nested child group
      const layerManager = createTestLayerManager();
      const { groupActor: parentGroup } = addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'parent-group' }),
        { visible: true },
      );
      const { groupActor: childGroup } = addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'child-group', parentId: 'parent-group' }),
        { visible: true },
      );
      const { childActor } = addChildLayerToGroup(
        layerManager,
        'child-group',
        createTestLayerConfig({ layerId: 'child-layer' }),
        { visible: true },
      );

      // disable the parent group
      parentGroup.send({ type: 'LAYER.DISABLED' });

      // Verify: Children are enabled but hidden
      expect(childGroup.getSnapshot().value).toEqual({ enabled: 'hidden' });
      expect(childActor.getSnapshot().value).toEqual({ enabled: 'hidden' });

      // Action: toggle the child layer visibility
      childActor.send({ type: 'LAYER.DISABLED' });
      childActor.send({ type: 'LAYER.ENABLED' });

      // verify the parent group becomes enabled
      expect(parentGroup.getSnapshot().value).toEqual({ enabled: 'visible' });
    });

    it('it is possible to add an enabled but hidden child', () => {
      // Setup: Create a disabled group
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }), {
        visible: false,
      });

      // Action: Add a visible child layer
      const { childActor } = addChildLayerToGroup(
        layerManager,
        'group-1',
        createTestLayerConfig({ layerId: 'child-1' }),
        { enabled: true },
      );

      // Verify: Child becomes enabled:visible
      expect(childActor.getSnapshot().value).toEqual({ enabled: 'hidden' });

      // Verify: Group remains disabled
      expect(groupActor.getSnapshot().value).toEqual({ disabled: 'hidden' });
    });
  });

  describe('nested group layers', () => {
    it('allows a group layer to contain another group layer when allowed', () => {
      // Setup: Create a manager that allows nested groups
      const layerManager = createTestLayerManager({ allowNestedGroupLayers: true });
      const { groupActor: parentGroup } = addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'parent-group' }),
      );

      // Action: Add a child group to the parent group
      const { groupActor: childGroup } = addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'child-group', parentId: 'parent-group' }),
      );

      // Verify: Child group is added to parent's children
      const parentSnapshot = parentGroup.getSnapshot();
      expect(parentSnapshot.context.children).toHaveLength(1);
      expect(parentSnapshot.context.children[0].id).toBe('child-group');

      // Verify: Child group has correct parent reference
      const childSnapshot = childGroup.getSnapshot();
      expect(childSnapshot.context.parentRef).toBeDefined();
    });

    it('blocks a group layer from containing another group layer when not allowed', () => {
      // Setup: Create a manager that does not allow nested groups
      const layerManager = createTestLayerManager({ allowNestedGroupLayers: false });
      addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'parent-group' }));

      // Action: Try to add a child group (should fail and throw error)
      expect(() => {
        addLayerGroupToManager(
          layerManager,
          createTestLayerGroupConfig({ layerId: 'child-group', parentId: 'parent-group' }),
        );
      }).toThrow();

      // Verify: Child group is not in the manager's layers
      const managerSnapshot = layerManager.getSnapshot();
      const childGroup = managerSnapshot.context.layers.find((l) => l.layerActor.id === 'child-group');
      expect(childGroup).toBeUndefined();
    });
  });

  describe('parent group communication', () => {
    it('a child group alerts the parent group when it becomes visible', () => {
      // Setup: Create a parent group with a nested child group
      const layerManager = createTestLayerManager({ allowNestedGroupLayers: true });
      const { groupActor: parentGroup } = addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'parent-group' }),
        { visible: false },
      );
      const { groupActor: childGroup } = addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'child-group', parentId: 'parent-group' }),
        { visible: false },
      );

      // Verify: Both groups start visible and disabled
      expect(parentGroup.getSnapshot().value).toEqual({ disabled: 'hidden' });
      expect(childGroup.getSnapshot().value).toEqual({ disabled: 'hidden' });

      // Action: Make visible the child group
      childGroup.send({ type: 'LAYER.ENABLED' });

      // Verify: Parent becomes visible and child group becomes visible
      expect(parentGroup.getSnapshot().value).toEqual({ enabled: 'visible' });
      expect(childGroup.getSnapshot().value).toEqual({ enabled: 'visible' });
    });

    it('recalculates computed opacity for child groups when parent opacity changes', () => {
      // Setup: Create a parent group and a nested child group with their own opacities
      const layerManager = createTestLayerManager({ allowNestedGroupLayers: true });
      const { groupActor: parentGroup } = addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'parent-group', opacity: 0.5 }),
        { visible: true },
      );
      const { groupActor: childGroup } = addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'child-group', parentId: 'parent-group', opacity: 0.8 }),
        { visible: true },
      );

      // Sanity check: initial computed opacity is parent * child
      const initialChildSnapshot = childGroup.getSnapshot();
      expect(initialChildSnapshot.context.opacity).toBe(0.8);
      expect(initialChildSnapshot.context.computedOpacity).toEqual(0.5 * 0.8);

      // Action: change opacity on the parent group
      parentGroup.send({ type: 'LAYER.SET_OPACITY', opacity: 0.25 });

      // Verify: child group receives PARENT.OPACITY_CHANGED and recomputes its own opacity
      const updatedChildSnapshot = childGroup.getSnapshot();
      expect(updatedChildSnapshot.context.computedOpacity).toEqual(0.25 * 0.8);
    });
  });
});
