import type { TestLayerData } from './utils/layer-manager-helpers';
import { describe, expect, it, vi } from 'vitest';
import { LayerManager } from '../src/LayerManager';
import { createTestLayerConfig, createTestLayerGroupConfig } from './utils/layer-manager-helpers';

describe('layerManager', () => {
  describe('reset', () => {
    it('reports every layer as removed', () => {
      const onLayerRemoved = vi.fn();
      const manager = new LayerManager<TestLayerData, TestLayerData>({ onLayerRemoved });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1' }) });
      manager.addLayer({ layerConfig: createTestLayerConfig({ layerId: 'child-1', parentId: 'group-1' }) });
      manager.addLayer({ layerConfig: createTestLayerConfig({ layerId: 'layer-1' }) });

      manager.reset();

      expect(onLayerRemoved.mock.calls.map(([layerId]) => layerId).sort()).toEqual(['child-1', 'group-1', 'layer-1']);
      expect(manager.layers).toEqual([]);
    });

    it('stops every layer', () => {
      const manager = new LayerManager<TestLayerData, TestLayerData>();
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1' }) });
      manager.addLayer({ layerConfig: createTestLayerConfig({ layerId: 'layer-1' }) });
      const group = manager.getLayer('group-1');
      const layer = manager.getLayer('layer-1');

      manager.reset();

      expect(group?.layerActor.getSnapshot().status).toBe('stopped');
      expect(layer?.layerActor.getSnapshot().status).toBe('stopped');
    });
  });
});
