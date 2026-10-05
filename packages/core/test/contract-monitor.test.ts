import type { LayerInfo } from '../src/adapters/types';
import type { TestLayerData } from './utils/layer-manager-helpers';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import { monitorContract } from './utils/contract-monitor';
import { createMapModel } from './utils/map-model';

function info(layerId: string, overrides: Partial<LayerInfo<TestLayerData>> = {}): LayerInfo<TestLayerData> {
  return {
    layerId,
    layerName: layerId,
    layerType: 'layer',
    layerData: { test: layerId },
    listMode: 'show',
    parentId: null,
    enabled: false,
    visible: false,
    opacity: 1,
    computedOpacity: 1,
    ...overrides,
  };
}

describe('contract monitor', () => {
  it('passes a sequence that keeps the contract and forwards every call', () => {
    const map = createMapModel<TestLayerData>();
    const { adapter, assertMet } = monitorContract(map);

    adapter.onLayerAdded?.(info('a'));
    adapter.onOrderChanged?.(['a']);
    adapter.onVisibilityChanged?.(info('a', { enabled: true, visible: true }), true);

    expect(() => assertMet()).not.toThrow();
    expect(map.layers.get('a')).toMatchObject({ visible: true });
    expect(map.order).toEqual(['a']);
  });

  it('reports a call for a layer that was never added or was already removed', () => {
    const { adapter, assertMet } = monitorContract(createMapModel<TestLayerData>());
    adapter.onVisibilityChanged?.(info('never-added', { enabled: true, visible: true }), true);
    adapter.onLayerAdded?.(info('a'));
    adapter.onOrderChanged?.(['a']);
    adapter.onLayerRemoved?.('a');
    adapter.onOrderChanged?.([]);

    adapter.onOpacityChanged?.(info('a', { opacity: 0.5, computedOpacity: 0.5 }), 0.5);

    expect(() => assertMet()).toThrow([
      'onVisibilityChanged for layer never-added, which the adapter was not told about or was told was removed',
      'onOpacityChanged for layer a, which the adapter was not told about or was told was removed',
    ].join('\n'));
  });

  it('reports a layer added twice, and any call after unregister until the adapter is registered again', () => {
    const { adapter, assertMet } = monitorContract(createMapModel<TestLayerData>());
    adapter.register?.();
    adapter.onLayerAdded?.(info('a'));
    adapter.onLayerAdded?.(info('a'));
    adapter.onOrderChanged?.(['a']);
    adapter.unregister?.();

    adapter.onOrderChanged?.([]);
    adapter.register?.();
    adapter.onLayerAdded?.(info('a'));
    adapter.onOrderChanged?.(['a']);

    expect(() => assertMet()).toThrow([
      'onLayerAdded for layer a, which was already added',
      'onOrderChanged after unregister',
    ].join('\n'));
  });

  it('reports an order that is late, or that lists other IDs than the current layers', () => {
    const { adapter, assertMet } = monitorContract(createMapModel<TestLayerData>());
    adapter.onLayerAdded?.(info('a'));
    adapter.onVisibilityChanged?.(info('a', { enabled: true, visible: true }), true);
    adapter.onOrderChanged?.(['a', 'ghost']);

    adapter.onLayerAdded?.(info('b'));

    expect(() => assertMet()).toThrow([
      'onVisibilityChanged for layer a before onOrderChanged reported the last add or remove',
      'onOrderChanged listed [a, ghost], but the current layers are [a]',
      'the last add or remove was never followed by onOrderChanged',
    ].join('\n'));
  });

  it('reports a call that repeats the value the adapter already has, except new layer data', () => {
    const { adapter, assertMet } = monitorContract(createMapModel<TestLayerData>());
    const newYearsDay = () => ({ type: 'single' as const, precision: 'date' as const, value: Temporal.PlainDate.from('2024-01-01') });
    adapter.onLayerAdded?.(info('a'));
    adapter.onLayerAdded?.(info('b', { timeInfo: newYearsDay() }));
    adapter.onOrderChanged?.(['a', 'b']);

    adapter.onVisibilityChanged?.(info('a'), false);
    adapter.onEnabledChanged?.(info('a'), false);
    adapter.onOpacityChanged?.(info('a'), 1);
    adapter.onTimeInfoChanged?.(info('b', { timeInfo: newYearsDay() }), newYearsDay());
    adapter.onLayerDataChanged?.(info('a'));
    adapter.onOrderChanged?.(['a', 'b']);
    adapter.onLayerMoved?.(info('a'));

    expect(() => assertMet()).toThrow([
      'onVisibilityChanged for layer a repeated visible false',
      'onEnabledChanged for layer a repeated enabled false',
      'onOpacityChanged for layer a repeated opacity 1 and computed opacity 1',
      'onTimeInfoChanged for layer b repeated the same time info',
      'onLayerMoved for layer a changed neither its parent nor the order',
    ].join('\n'));
  });
});
