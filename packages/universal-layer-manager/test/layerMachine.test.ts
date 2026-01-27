import type { SingleTimeInfo } from '../src/types';

import { ZonedDateTime } from '@internationalized/date';
import { describe, expect, it, vi } from 'vitest';
import {
  addChildLayerToGroup,
  addLayerGroupToManager,
  addLayerToManager,
  createLayerWithManager,
  createTestLayerConfig,
  createTestLayerGroupConfig,
  createTestLayerManager,
} from './utils/layer-manager-helpers';

describe('layerMachine', () => {
  describe('initial state', () => {
    it('initial config matches the input config', () => {
      // Setup: Create a layer that is not visible
      const { layerActor } = createLayerWithManager({ visible: false });

      // Verify: Layer starts in disabled/hidden state with values from the input config
      const snapshot = layerActor.getSnapshot();
      expect(snapshot.value).toEqual({ disabled: 'hidden' });
      expect(snapshot.context.layerId).toBe('layer-1');
      expect(snapshot.context.layerName).toBe('Test layer');
      expect(snapshot.context.listMode).toBe('show');
      expect(snapshot.context.opacity).toBe(1);
      expect(snapshot.context.layerType).toBe('layer');
    });

    it('initializes with custom opacity', () => {
      // Setup: Create a layer with custom opacity
      const { layerActor } = createLayerWithManager({ opacity: 0.3 });

      // Verify: Layer context has the custom opacity
      expect(layerActor.getSnapshot().context.opacity).toBe(0.3);
    });

    it('initializes with custom layer data', () => {
      // Setup: Create a layer with custom layer data
      const customData = { test: 'custom-1' };
      const { layerActor } = createLayerWithManager({ layerData: customData });

      // Verify: Layer context contains the custom data
      expect(layerActor.getSnapshot().context.layerData).toEqual(customData);
    });

    it('initializes with time info', () => {
      // Setup: Create a layer with time information
      const timeInfo: SingleTimeInfo = {
        type: 'single',
        precision: 'date',
        value: new ZonedDateTime(2024, 1, 1, 'UTC', 0),
      };
      const { layerActor } = createLayerWithManager({ timeInfo });

      // Verify: Layer context contains the time info
      expect(layerActor.getSnapshot().context.timeInfo).toEqual(timeInfo);
    });
  });

  describe('state transitions', () => {
    it('transitions from disabled to enabled', () => {
      // Setup: Create a disabled (hidden) layer
      const { layerActor } = createLayerWithManager({ visible: false });

      // Verify: Starts in disabled state
      expect(layerActor.getSnapshot().value).toEqual({ disabled: 'hidden' });

      // Action: Enable the layer
      layerActor.send({ type: 'LAYER.ENABLED' });

      // Verify: Transitions to enabled/visible state
      expect(layerActor.getSnapshot().value).toEqual({ enabled: 'visible' });
    });

    it('transitions from enabled to disabled', () => {
      // Setup: Create an enabled (visible) layer
      const { layerActor } = createLayerWithManager({ visible: true });

      // Verify: Starts in enabled state
      expect(layerActor.getSnapshot().value).toEqual({ enabled: 'visible' });

      // Action: Disable the layer
      layerActor.send({ type: 'LAYER.DISABLED' });

      // Verify: Transitions to disabled/hidden state
      expect(layerActor.getSnapshot().value).toEqual({ disabled: 'hidden' });
    });
  });

  describe('context updates', () => {
    it('updates opacity when LAYER.SET_OPACITY is sent', () => {
      // Setup: Create a layer with initial opacity
      const { layerActor } = createLayerWithManager({ opacity: 0.5 });

      // Verify: Initial opacity is set
      expect(layerActor.getSnapshot().context.opacity).toBe(0.5);

      // Action: Update opacity
      layerActor.send({ type: 'LAYER.SET_OPACITY', opacity: 0.75 });

      // Verify: Opacity is updated
      expect(layerActor.getSnapshot().context.opacity).toBe(0.75);
    });

    it('updates opacity multiple times', () => {
      // Setup: Create a layer with default opacity
      const { layerActor } = createLayerWithManager();

      // Action & Verify: Update opacity multiple times
      layerActor.send({ type: 'LAYER.SET_OPACITY', opacity: 0.2 });
      expect(layerActor.getSnapshot().context.opacity).toBe(0.2);

      layerActor.send({ type: 'LAYER.SET_OPACITY', opacity: 0.5 });
      expect(layerActor.getSnapshot().context.opacity).toBe(0.5);

      layerActor.send({ type: 'LAYER.SET_OPACITY', opacity: 0.9 });
      expect(layerActor.getSnapshot().context.opacity).toBe(0.9);
    });

    it('updates time info when LAYER.SET_TIME_INFO is sent', () => {
      // Setup: Create a layer without time info
      const { layerActor } = createLayerWithManager();

      // Action: Set initial time info
      const initialTimeInfo: SingleTimeInfo = {
        type: 'single',
        precision: 'date',
        value: new ZonedDateTime(2024, 1, 1, 'UTC', 0),
      };
      layerActor.send({ type: 'LAYER.SET_TIME_INFO', timeInfo: initialTimeInfo });

      // Verify: Time info is set
      expect(layerActor.getSnapshot().context.timeInfo).toEqual(initialTimeInfo);

      // Action: Update time info
      const updatedTimeInfo: SingleTimeInfo = {
        type: 'single',
        precision: 'datetime',
        value: new ZonedDateTime(2024, 6, 15, 'UTC', 0),
      };
      layerActor.send({ type: 'LAYER.SET_TIME_INFO', timeInfo: updatedTimeInfo });

      // Verify: Time info is updated
      expect(layerActor.getSnapshot().context.timeInfo).toEqual(updatedTimeInfo);
    });

    it('updates layer data when LAYER.SET_LAYER_DATA is sent', () => {
      // Setup: Create a layer with initial data
      const { layerActor } = createLayerWithManager();

      // Verify: Initial layer data
      expect(layerActor.getSnapshot().context.layerData).toEqual({ test: 'test' });

      // Action: Update layer data
      layerActor.send({
        type: 'LAYER.SET_LAYER_DATA',
        layerData: { test: 'updated' },
      });

      // Verify: Layer data is updated
      expect(layerActor.getSnapshot().context.layerData).toEqual({ test: 'updated' });
    });
  });

  describe('event emissions to layer manager', () => {
    it('emits LAYER.VISIBILITY_CHANGED events when layer is enabled', () => {
      // Setup: Create a manager with a layer
      const layerManager = createTestLayerManager();
      const { layerActor } = addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }), { visible: false });

      const visibilityChangeWatcher = vi.fn();
      layerManager.on('LAYER.VISIBILITY_CHANGED', visibilityChangeWatcher);
      layerActor.send({ type: 'LAYER.ENABLED' });

      expect(visibilityChangeWatcher).toHaveBeenCalledWith({ type: 'LAYER.VISIBILITY_CHANGED', layerId: 'layer-1', visible: true });
    });

    it('emits LAYER.VISIBILITY_CHANGED events when layer is disabled', () => {
      // Setup: Create a manager with a layer
      const layerManager = createTestLayerManager();
      const { layerActor } = addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }), { visible: true });

      const visibilityChangeWatcher = vi.fn();
      layerManager.on('LAYER.VISIBILITY_CHANGED', visibilityChangeWatcher);
      layerActor.send({ type: 'LAYER.DISABLED' });

      expect(visibilityChangeWatcher).toHaveBeenCalledWith({ type: 'LAYER.VISIBILITY_CHANGED', layerId: 'layer-1', visible: false });
    });

    it('doesn\'t emit LAYER.VISIBILITY_CHANGED events when layer is already in the desired state', () => {
      // Setup: Create a manager with a layer
      const layerManager = createTestLayerManager();
      const { layerActor } = addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }), { visible: true });

      const visibilityChangeWatcher = vi.fn();
      layerManager.on('LAYER.VISIBILITY_CHANGED', visibilityChangeWatcher);
      layerActor.send({ type: 'LAYER.ENABLED' });

      expect(visibilityChangeWatcher).not.toHaveBeenCalled();
    });

    it('emits LAYER.OPACITY_CHANGED events when opacity is updated', () => {
      // Setup: Create a manager with a layer
      const layerManager = createTestLayerManager();
      const { layerActor } = addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));

      const opacityChangeWatcher = vi.fn();
      layerManager.on('LAYER.OPACITY_CHANGED', opacityChangeWatcher);

      // Action: Update opacity via the layer machine
      layerActor.send({ type: 'LAYER.SET_OPACITY', opacity: 0.5 });

      // Verify: Manager emits opacity changed event with correct payload
      expect(opacityChangeWatcher).toHaveBeenCalledWith({
        type: 'LAYER.OPACITY_CHANGED',
        layerId: 'layer-1',
        opacity: 0.5,
        computedOpacity: 0.5,
      });
    });

    it('emits LAYER.TIME_INFO_CHANGED events when time info is updated', () => {
      // Setup: Create a manager with a layer
      const layerManager = createTestLayerManager();
      const { layerActor } = addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));

      const timeInfoChangeWatcher = vi.fn();
      layerManager.on('LAYER.TIME_INFO_CHANGED', timeInfoChangeWatcher);

      const timeInfo: SingleTimeInfo = {
        type: 'single',
        precision: 'date',
        value: new ZonedDateTime(2024, 1, 1, 'UTC', 0),
      };

      // Action: Update time info via the layer machine
      layerActor.send({ type: 'LAYER.SET_TIME_INFO', timeInfo });

      // Verify: Manager emits time info changed event with correct payload
      expect(timeInfoChangeWatcher).toHaveBeenCalledWith({
        type: 'LAYER.TIME_INFO_CHANGED',
        layerId: 'layer-1',
        timeInfo,
      });
    });

    it('emits LAYER.LAYER_DATA_CHANGED events when layer data is updated', () => {
      // Setup: Create a manager with a layer
      const layerManager = createTestLayerManager();
      const { layerActor } = addLayerToManager(layerManager, createTestLayerConfig({ layerId: 'layer-1' }));

      const layerDataChangeWatcher = vi.fn();
      layerManager.on('LAYER.LAYER_DATA_CHANGED', layerDataChangeWatcher);

      const updatedLayerData = { test: 'updated' };

      // Action: Update layer data via the layer machine
      layerActor.send({
        type: 'LAYER.SET_LAYER_DATA',
        layerData: updatedLayerData,
      });

      // Verify: Manager emits layer data changed event with correct payload
      expect(layerDataChangeWatcher).toHaveBeenCalledWith({
        type: 'LAYER.LAYER_DATA_CHANGED',
        layerId: 'layer-1',
        layerData: updatedLayerData,
      });
    });
  });

  describe('communication with parent layer group', () => {
    it('notifies parent group when the child layer becomes visible', () => {
      // Setup: Create a manager with a group and a child layer
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }), { visible: false });
      const { childActor } = addChildLayerToGroup(
        layerManager,
        'group-1',
        createTestLayerConfig({ layerId: 'child-1' }),
        { visible: false },
      );

      // Verify: Child starts disabled
      expect(childActor.getSnapshot().value).toEqual({ disabled: 'hidden' });

      // Verify: Group starts disabled
      expect(groupActor.getSnapshot().value).toEqual({ disabled: 'hidden' });

      // Action: Enable the child layer so it becomes visible
      childActor.send({ type: 'LAYER.ENABLED' });

      // Verify: Child becomes visible
      expect(childActor.getSnapshot().value).toEqual({ enabled: 'visible' });

      // Verify: Group becomes visible
      expect(groupActor.getSnapshot().value).toEqual({ enabled: 'visible' });
    });

    it('updates child visibility when parent group visibility changes', () => {
      // Setup: Create a visible parent group with a child layer
      const layerManager = createTestLayerManager();
      addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'group-1' }),
        { visible: true },
      );
      const { childActor } = addChildLayerToGroup(
        layerManager,
        'group-1',
        createTestLayerConfig({ layerId: 'child-1' }),
        { visible: true, enabled: true },
      );

      // Sanity check: child is visible
      expect(childActor.getSnapshot().value).toEqual({ enabled: 'visible' });

      // Action: Parent becomes hidden via parent event
      childActor.send({ type: 'PARENT.HIDDEN' });

      // Verify: child transitions to hidden state
      expect(childActor.getSnapshot().value).toEqual({ enabled: 'hidden' });

      // Action: Parent becomes visible again
      childActor.send({ type: 'PARENT.VISIBLE' });

      // Verify: child transitions back to visible state
      expect(childActor.getSnapshot().value).toEqual({ enabled: 'visible' });
    });

    it('recalculates computed opacity when parent opacity changes', () => {
      // Setup: Create a parent group and a child layer
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'group-1', opacity: 0.5 }),
        { visible: true },
      );
      const { childActor } = addChildLayerToGroup(
        layerManager,
        'group-1',
        createTestLayerConfig({ layerId: 'child-1', opacity: 0.8 }),
        { visible: true, enabled: true },
      );

      // Sanity check: initial computed opacity is parent * child
      const initialSnapshot = childActor.getSnapshot();
      expect(initialSnapshot.context.opacity).toBe(0.8);
      expect(initialSnapshot.context.computedOpacity).toEqual(0.5 * 0.8);

      // Action: parent group changes its opacity
      groupActor.send({ type: 'LAYER.SET_OPACITY', opacity: 0.25 });

      // Parent notifies children via PARENT.OPACITY_CHANGED, which the child layer machine responds to
      const updatedSnapshot = childActor.getSnapshot();
      expect(updatedSnapshot.context.computedOpacity).toEqual(0.25 * 0.8);
    });
  });
});
