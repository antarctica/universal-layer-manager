import type { TestLayerData } from './utils/layer-manager-helpers';
import { describe, expect, it } from 'vitest';
import { connectAdapter } from '../src/connectAdapter';
import { monitorContract } from './utils/contract-monitor';
import { createTestLayerConfig, createTestLayerGroupConfig, createTestLayerManager } from './utils/layer-manager-helpers';
import { createMapModel } from './utils/map-model';

function connectMap(manager: ReturnType<typeof createTestLayerManager<TestLayerData, TestLayerData>>) {
  const map = createMapModel<TestLayerData>();
  const monitor = monitorContract(map);
  const disconnect = connectAdapter(manager, monitor.adapter);
  return { map, monitor, disconnect };
}

describe('connectAdapter', () => {
  it('tells an adapter about the layers a manager actor already holds', () => {
    const manager = createTestLayerManager<TestLayerData, TestLayerData>();
    manager.send({ type: 'LAYER.ADD', params: { layerConfig: createTestLayerGroupConfig<TestLayerData>({ layerId: 'group-1' }), visible: true } });
    manager.send({ type: 'LAYER.ADD', params: { layerConfig: createTestLayerConfig({ layerId: 'layer-1', parentId: 'group-1' }), visible: true } });

    const { map, monitor } = connectMap(manager);

    expect(map.registered).toBe(true);
    expect(map.order).toEqual(['group-1', 'layer-1']);
    expect(map.layers.get('layer-1')).toMatchObject({ parentId: 'group-1', visible: true });
    monitor.assertMet();
  });

  it('passes later changes on to the adapter', () => {
    const manager = createTestLayerManager<TestLayerData, TestLayerData>();
    const { map, monitor } = connectMap(manager);

    manager.send({ type: 'LAYER.ADD', params: { layerConfig: createTestLayerConfig({ layerId: 'layer-1', opacity: 1 }), visible: true } });
    manager.getSnapshot().children['layer-1']?.send({ type: 'LAYER.SET_OPACITY', opacity: 0.5 });

    expect(map.order).toEqual(['layer-1']);
    expect(map.layers.get('layer-1')).toMatchObject({ visible: true, opacity: 0.5, computedOpacity: 0.5 });
    monitor.assertMet();
  });

  it('stops passing changes on, and unregisters the adapter, once disconnected', () => {
    const manager = createTestLayerManager<TestLayerData, TestLayerData>();
    const { map, monitor, disconnect } = connectMap(manager);

    disconnect();
    manager.send({ type: 'LAYER.ADD', params: { layerConfig: createTestLayerConfig({ layerId: 'layer-1' }), visible: true } });

    expect(map.registered).toBe(false);
    expect(map.layers.size).toBe(0);
    monitor.assertMet();
  });
});
