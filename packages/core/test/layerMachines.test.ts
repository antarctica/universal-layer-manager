import { describe, expect, it, vi } from 'vitest';
import {
  addChildLayerToGroup,
  addLayerGroupToManager,
  createLayerWithManager,
  createTestLayerConfig,
  createTestLayerGroupConfig,
  createTestLayerManager,
} from './utils/layer-manager-helpers';

// Rules for consumers that hold layer and group actors directly.
// Behaviour reachable through LayerManager is specified in LayerManager.test.ts.
describe('layer and group machines', () => {
  describe('state a consumer can select on', () => {
    it('marks a visible layer as enabled and visible', () => {
      const { layerActor } = createLayerWithManager({ visible: true });

      const snapshot = layerActor.getSnapshot();
      expect(snapshot.hasTag('enabled')).toBe(true);
      expect(snapshot.hasTag('visible')).toBe(true);
      expect(snapshot.matches({ enabled: 'visible' })).toBe(true);
    });

    it('marks a layer hidden by its group as enabled but not visible', () => {
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }), { visible: true });
      const { childActor } = addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-1' }), { visible: true });

      groupActor.send({ type: 'LAYER.DISABLED' });

      const snapshot = childActor.getSnapshot();
      expect(snapshot.hasTag('enabled')).toBe(true);
      expect(snapshot.hasTag('visible')).toBe(false);
      expect(snapshot.matches({ enabled: 'hidden' })).toBe(true);
    });

    it('marks a switched-off layer as neither enabled nor visible', () => {
      const { layerActor } = createLayerWithManager({ visible: false });

      const snapshot = layerActor.getSnapshot();
      expect(snapshot.hasTag('enabled')).toBe(false);
      expect(snapshot.hasTag('visible')).toBe(false);
      expect(snapshot.matches('disabled')).toBe(true);
    });

    it('marks a visible group as enabled and visible', () => {
      const layerManager = createTestLayerManager();
      const { groupActor } = addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }), { visible: true });

      const snapshot = groupActor.getSnapshot();
      expect(snapshot.hasTag('enabled')).toBe(true);
      expect(snapshot.hasTag('visible')).toBe(true);
    });
  });

  describe('opacity messages from the parent group', () => {
    it('derives a group\'s computed opacity from the opacity its parent sends', () => {
      const layerManager = createTestLayerManager({ allowNestedGroupLayers: true });
      addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'parent-group' }));
      const { groupActor: childGroup } = addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'child-group', parentId: 'parent-group', opacity: 0.8 }),
      );
      const opacityWatcher = vi.fn();
      layerManager.on('LAYER.OPACITY_CHANGED', opacityWatcher);

      childGroup.send({ type: 'PARENT.OPACITY_CHANGED', opacity: 0.5 });

      expect(opacityWatcher).toHaveBeenCalledWith({ type: 'LAYER.OPACITY_CHANGED', layerId: 'child-group', opacity: 0.8, computedOpacity: 0.4 });
    });

    it('combines a layer\'s own opacity with the last opacity its parent sent', () => {
      const layerManager = createTestLayerManager();
      addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'group-1' }));
      const { childActor } = addChildLayerToGroup(layerManager, 'group-1', createTestLayerConfig({ layerId: 'child-1' }));
      childActor.send({ type: 'PARENT.OPACITY_CHANGED', opacity: 0.5 });
      const opacityWatcher = vi.fn();
      layerManager.on('LAYER.OPACITY_CHANGED', opacityWatcher);

      childActor.send({ type: 'LAYER.SET_OPACITY', opacity: 0.8 });

      expect(opacityWatcher).toHaveBeenCalledWith({ type: 'LAYER.OPACITY_CHANGED', layerId: 'child-1', opacity: 0.8, computedOpacity: 0.4 });
    });

    it('combines a group\'s own opacity with the last opacity its parent sent', () => {
      const layerManager = createTestLayerManager({ allowNestedGroupLayers: true });
      addLayerGroupToManager(layerManager, createTestLayerGroupConfig({ layerId: 'parent-group' }));
      const { groupActor: childGroup } = addLayerGroupToManager(
        layerManager,
        createTestLayerGroupConfig({ layerId: 'child-group', parentId: 'parent-group' }),
      );
      childGroup.send({ type: 'PARENT.OPACITY_CHANGED', opacity: 0.5 });
      const opacityWatcher = vi.fn();
      layerManager.on('LAYER.OPACITY_CHANGED', opacityWatcher);

      childGroup.send({ type: 'LAYER.SET_OPACITY', opacity: 0.8 });

      expect(opacityWatcher).toHaveBeenCalledWith({ type: 'LAYER.OPACITY_CHANGED', layerId: 'child-group', opacity: 0.8, computedOpacity: 0.4 });
    });
  });
});
