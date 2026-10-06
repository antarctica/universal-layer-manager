import type { LayerManagerAdapter } from '../src/adapters/types';
import type { TestLayerData, TestLayerManager } from './utils/layer-manager-helpers';
import { describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { connectAdapter } from '../src/connectAdapter';
import { createLayerManagerMachine } from '../src/layerManagerMachines/layerManagerMachine';
import { monitorContract } from './utils/contract-monitor';
import { createTestLayerConfig, createTestLayerGroupConfig, createTestLayerManager } from './utils/layer-manager-helpers';
import { createMapModel } from './utils/map-model';

function connectMap(manager: TestLayerManager) {
  const map = createMapModel<TestLayerData>();
  const monitor = monitorContract(map);
  const disconnect = connectAdapter(manager, monitor.adapter);
  return { map, monitor, disconnect };
}

describe('connectAdapter', () => {
  it('tells an adapter about the layers a manager actor already holds', () => {
    const manager = createTestLayerManager();
    manager.send({ type: 'LAYER.ADD', params: { layerConfig: createTestLayerGroupConfig({ layerId: 'group-1' }), visible: true } });
    manager.send({ type: 'LAYER.ADD', params: { layerConfig: createTestLayerConfig({ layerId: 'layer-1', parentId: 'group-1' }), visible: true } });

    const { map, monitor } = connectMap(manager);

    expect(map.registered).toBe(true);
    expect(map.order).toEqual(['group-1', 'layer-1']);
    expect(map.layers.get('layer-1')).toMatchObject({ parentId: 'group-1', visible: true });
    monitor.assertMet();
  });

  it('passes later changes on to the adapter', () => {
    const manager = createTestLayerManager();
    const { map, monitor } = connectMap(manager);

    manager.send({ type: 'LAYER.ADD', params: { layerConfig: createTestLayerConfig({ layerId: 'layer-1', opacity: 1 }), visible: true } });
    manager.getSnapshot().children['layer-1']?.send({ type: 'LAYER.SET_OPACITY', opacity: 0.5 });

    expect(map.order).toEqual(['layer-1']);
    expect(map.layers.get('layer-1')).toMatchObject({ visible: true, opacity: 0.5, computedOpacity: 0.5 });
    monitor.assertMet();
  });

  it('stops passing changes on, and unregisters the adapter, once disconnected', () => {
    const manager = createTestLayerManager();
    const { map, monitor, disconnect } = connectMap(manager);

    disconnect();
    manager.send({ type: 'LAYER.ADD', params: { layerConfig: createTestLayerConfig({ layerId: 'layer-1' }), visible: true } });

    expect(map.registered).toBe(false);
    expect(map.layers.size).toBe(0);
    monitor.assertMet();
  });

  it('accepts a manager machine and an adapter typed with only the layer data type', () => {
    const manager = createActor(createLayerManagerMachine<TestLayerData>(), { input: { allowNestedGroupLayers: false } }).start();
    const adapter: LayerManagerAdapter<TestLayerData> = { onLayerAdded: vi.fn() };

    connectAdapter(manager, adapter);
    manager.send({ type: 'LAYER.ADD', params: { layerConfig: createTestLayerConfig({ layerId: 'layer-1' }), visible: true } });

    expect(adapter.onLayerAdded).toHaveBeenCalledTimes(1);
  });
});
