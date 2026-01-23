import type { SingleTimeInfo } from '../src/types';

import { ZonedDateTime } from '@internationalized/date';
import { describe, expect, it } from 'vitest';
import { createLayerWithManager } from './utils/layer-manager-helpers';

describe('layerMachine', () => {
  describe('initial state', () => {
    it('starts disabled and hidden with default context', () => {
      // Setup: Create a layer that is not visible
      const { layerActor } = createLayerWithManager({ visible: false });

      // Verify: Layer starts in disabled/hidden state with default values
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
});
