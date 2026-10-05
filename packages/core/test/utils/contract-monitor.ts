import type { LayerManagerAdapter } from '../../src/adapters/types';
import type { LayerTimeInfo } from '../../src/types';
import { isSameTimeInfo } from '../../src/utils';

export interface ContractMonitor<TLayer, TGroup> {
  /** Pass this to `setAdapter` in place of the adapter it wraps. */
  adapter: LayerManagerAdapter<TLayer, TGroup>;
  /** Throws a descriptive error if the manager broke a guarantee of the adapter contract. */
  assertMet: () => void;
}

/** What the adapter was last told about a layer. */
interface ReportedState {
  parentId: string | null;
  visible: boolean;
  enabled: boolean;
  opacity: number;
  computedOpacity: number;
  timeInfo?: LayerTimeInfo;
}

/**
 * Wraps an adapter, forwards every call to it, and records each call that breaks
 * the adapter contract in docs/adapters/writing-an-adapter.md. Free of any test runner.
 */
export function monitorContract<TLayer, TGroup>(inner: LayerManagerAdapter<TLayer, TGroup>): ContractMonitor<TLayer, TGroup> {
  const violations: string[] = [];
  const known = new Map<string, ReportedState>();
  let unregistered = false;
  let orderPending = false;
  let previousOrder: string[] = [];
  let currentOrder: string[] = [];

  function expectAttached(hook: string): boolean {
    if (unregistered) {
      violations.push(`${hook} after unregister`);
    }
    return !unregistered;
  }

  function expectKnown(hook: string, layerId: string): ReportedState | undefined {
    if (!expectAttached(hook)) {
      return undefined;
    }
    const state = known.get(layerId);
    if (!state) {
      violations.push(`${hook} for layer ${layerId}, which the adapter was not told about or was told was removed`);
    }
    return state;
  }

  function expectChange(hook: string, layerId: string): ReportedState | undefined {
    const state = expectKnown(hook, layerId);
    if (orderPending) {
      violations.push(`${hook} for layer ${layerId} before onOrderChanged reported the last add or remove`);
    }
    return state;
  }

  const adapter: LayerManagerAdapter<TLayer, TGroup> = {
    register: () => {
      unregistered = false;
      inner.register?.();
    },
    unregister: () => {
      unregistered = true;
      known.clear();
      orderPending = false;
      inner.unregister?.();
    },
    onLayerAdded: (info) => {
      if (expectAttached('onLayerAdded') && known.has(info.layerId)) {
        violations.push(`onLayerAdded for layer ${info.layerId}, which was already added`);
      }
      known.set(info.layerId, {
        parentId: info.parentId,
        visible: info.visible,
        enabled: info.enabled,
        opacity: info.opacity,
        computedOpacity: info.computedOpacity,
        timeInfo: info.timeInfo,
      });
      orderPending = true;
      inner.onLayerAdded?.(info);
    },
    onLayerRemoved: (layerId) => {
      expectKnown('onLayerRemoved', layerId);
      known.delete(layerId);
      orderPending = true;
      inner.onLayerRemoved?.(layerId);
    },
    onVisibilityChanged: (info, visible) => {
      const state = expectChange('onVisibilityChanged', info.layerId);
      if (state) {
        if (state.visible === visible) {
          violations.push(`onVisibilityChanged for layer ${info.layerId} repeated visible ${visible}`);
        }
        state.visible = visible;
      }
      inner.onVisibilityChanged?.(info, visible);
    },
    onEnabledChanged: (info, enabled) => {
      const state = expectChange('onEnabledChanged', info.layerId);
      if (state) {
        if (state.enabled === enabled) {
          violations.push(`onEnabledChanged for layer ${info.layerId} repeated enabled ${enabled}`);
        }
        state.enabled = enabled;
      }
      inner.onEnabledChanged?.(info, enabled);
    },
    onOpacityChanged: (info, computedOpacity) => {
      const state = expectChange('onOpacityChanged', info.layerId);
      if (state) {
        if (state.opacity === info.opacity && state.computedOpacity === computedOpacity) {
          violations.push(`onOpacityChanged for layer ${info.layerId} repeated opacity ${info.opacity} and computed opacity ${computedOpacity}`);
        }
        state.opacity = info.opacity;
        state.computedOpacity = computedOpacity;
      }
      inner.onOpacityChanged?.(info, computedOpacity);
    },
    onTimeInfoChanged: (info, timeInfo) => {
      const state = expectChange('onTimeInfoChanged', info.layerId);
      if (state) {
        if (isSameTimeInfo(state.timeInfo, timeInfo)) {
          violations.push(`onTimeInfoChanged for layer ${info.layerId} repeated the same time info`);
        }
        state.timeInfo = timeInfo;
      }
      inner.onTimeInfoChanged?.(info, timeInfo);
    },
    onLayerDataChanged: (info) => {
      expectChange('onLayerDataChanged', info.layerId);
      inner.onLayerDataChanged?.(info);
    },
    onOrderChanged: (layerOrder) => {
      if (expectAttached('onOrderChanged')) {
        const listed = [...layerOrder].sort();
        const current = [...known.keys()].sort();
        if (listed.join() !== current.join() || new Set(layerOrder).size !== layerOrder.length) {
          violations.push(`onOrderChanged listed [${layerOrder.join(', ')}], but the current layers are [${[...known.keys()].join(', ')}]`);
        }
      }
      orderPending = false;
      previousOrder = currentOrder;
      currentOrder = [...layerOrder];
      inner.onOrderChanged?.(layerOrder);
    },
    onLayerMoved: (info) => {
      const state = expectChange('onLayerMoved', info.layerId);
      if (state) {
        if (state.parentId === info.parentId && previousOrder.join() === currentOrder.join()) {
          violations.push(`onLayerMoved for layer ${info.layerId} changed neither its parent nor the order`);
        }
        state.parentId = info.parentId;
      }
      inner.onLayerMoved?.(info);
    },
  };

  return {
    adapter,
    assertMet: () => {
      const unmet = orderPending ? [...violations, 'the last add or remove was never followed by onOrderChanged'] : violations;
      if (unmet.length > 0) {
        throw new Error(unmet.join('\n'));
      }
    },
  };
}
