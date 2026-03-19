import type { LayerManagerAdapter, LayerManagerCallbacks } from '../../src/adapters/types';
import type { LayerManager } from '../../src/LayerManager';
import { describe, expect, it, vi } from 'vitest';

describe('layerManagerAdapter contract', () => {
  it('allows a mock adapter to implement register and unregister', () => {
    const registerSpy = vi.fn();
    const unregisterSpy = vi.fn();

    const mockAdapter: LayerManagerAdapter = {
      register: registerSpy,
      unregister: unregisterSpy,
    };

    const mockLayerManager = {} as LayerManager<unknown, unknown>;
    const callbacks = {} as LayerManagerCallbacks<unknown, unknown>;
    mockAdapter.register?.(mockLayerManager, callbacks);
    expect(registerSpy).toHaveBeenCalledTimes(1);

    mockAdapter.unregister?.();
    expect(unregisterSpy).toHaveBeenCalledTimes(1);
  });

  it('allows optional layer lifecycle hooks', () => {
    const onLayerAddedSpy = vi.fn();
    const adapter: LayerManagerAdapter = {
      register: vi.fn(),
      unregister: vi.fn(),
      onLayerAdded: onLayerAddedSpy,
    };

    expect(adapter.onLayerAdded).toBeDefined();
  });
});
