import type { TestLayerData } from './utils/layer-manager-helpers';
import { describe, expect, it, vi } from 'vitest';
import { LayerManager } from '../src/LayerManager';
import { createTestLayerConfig, createTestLayerGroupConfig } from './utils/layer-manager-helpers';

describe('layerManager', () => {
  describe('adding layers', () => {
    it('reports an enabled top-level layer as visible when it is added', () => {
      const onLayerAdded = vi.fn();
      const manager = new LayerManager<TestLayerData, TestLayerData>({ onLayerAdded });

      manager.addLayer({ layerConfig: createTestLayerConfig({ layerId: 'layer-1' }), enabled: true });

      expect(onLayerAdded).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'layer-1', enabled: true, visible: true }));
    });

    it('shows an enabled layer added to a visible group', () => {
      const onLayerAdded = vi.fn();
      const manager = new LayerManager<TestLayerData, TestLayerData>({ onLayerAdded });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1' }), visible: true });

      manager.addLayer({ layerConfig: createTestLayerConfig({ layerId: 'child-1', parentId: 'group-1' }), enabled: true });

      expect(onLayerAdded).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'child-1', enabled: true, visible: true }));
    });

    it('reports a group added as visible as enabled and visible', () => {
      const onLayerAdded = vi.fn();
      const manager = new LayerManager<TestLayerData, TestLayerData>({ onLayerAdded });

      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1' }), visible: true });

      expect(onLayerAdded).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'group-1', enabled: true, visible: true }));
    });

    it('keeps an enabled group added to a disabled group enabled but hidden', () => {
      const onLayerAdded = vi.fn();
      const manager = new LayerManager<TestLayerData, TestLayerData>({ allowNestedGroupLayers: true, onLayerAdded });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'outer' }) });

      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'inner', parentId: 'outer' }), enabled: true });

      expect(onLayerAdded).toHaveBeenCalledWith(expect.objectContaining({ layerId: 'inner', enabled: true, visible: false }));
    });
  });

  describe('rejected changes', () => {
    it('reports adding a layer with an id that is already in use through onError', () => {
      const onError = vi.fn();
      const manager = new LayerManager<TestLayerData, TestLayerData>({ onError });
      manager.addLayer({ layerConfig: createTestLayerConfig({ layerId: 'layer-1' }) });

      manager.addLayer({ layerConfig: createTestLayerConfig({ layerId: 'layer-1' }) });

      expect(onError).toHaveBeenCalledWith(new Error('Layer with ID layer-1 already exists. Layer not added.'));
      expect(manager.layers).toHaveLength(1);
    });

    it('reports adding a layer to a parent that does not exist through onError', () => {
      const onError = vi.fn();
      const manager = new LayerManager<TestLayerData, TestLayerData>({ onError });

      manager.addLayer({ layerConfig: createTestLayerConfig({ layerId: 'child-1', parentId: 'missing-group' }) });

      expect(onError).toHaveBeenCalledWith(new Error('Unable to find parent group missing-group. Layer child-1 not added.'));
      expect(manager.getLayer('child-1')).toBeUndefined();
    });

    it('reports removing a layer that does not exist through onError', () => {
      const onError = vi.fn();
      const manager = new LayerManager<TestLayerData, TestLayerData>({ onError });

      manager.removeLayer('missing-layer');

      expect(onError).toHaveBeenCalledWith(new Error('Unable to find layer missing-layer. Layer not removed.'));
    });

    it('reports removing a group that still has children through onError', () => {
      const onError = vi.fn();
      const manager = new LayerManager<TestLayerData, TestLayerData>({ onError });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'group-1' }) });
      manager.addLayer({ layerConfig: createTestLayerConfig({ layerId: 'child-1', parentId: 'group-1' }) });

      manager.removeLayer('group-1');

      expect(onError).toHaveBeenCalledWith(new Error('Layer group group-1 has children. Layer not removed.'));
      expect(manager.getLayer('group-1')).toBeDefined();
    });
  });

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

  describe('opacity', () => {
    it('reports a nested group\'s computed opacity as its own opacity times its parent\'s', () => {
      const onOpacityChanged = vi.fn();
      const manager = new LayerManager<TestLayerData, TestLayerData>({ allowNestedGroupLayers: true, onOpacityChanged });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'outer' }) });
      manager.addGroup({ layerConfig: createTestLayerGroupConfig({ layerId: 'inner', parentId: 'outer', opacity: 0.8 }) });

      manager.setOpacity('outer', 0.5);

      const innerReports = onOpacityChanged.mock.calls.filter(([info]) => info.layerId === 'inner');
      expect(innerReports.map(([, computedOpacity]) => computedOpacity)).toEqual([0.4]);
    });
  });
});
