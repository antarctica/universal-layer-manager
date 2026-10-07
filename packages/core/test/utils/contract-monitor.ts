import type { LayerManagerAdapter } from '../../src/adapters/types';
import type { LayerTimeInfo } from '../../src/types';
import { isSameTimeInfo } from '../../src/utils';

/** What the adapter was told about a layer. */
interface ReportedState {
  parentId: string | null;
  visible: boolean;
  enabled: boolean;
  opacity: number;
  computedOpacity: number;
  timeInfo?: LayerTimeInfo;
}

/** One call the manager made on an adapter, with the values the contract checks read. */
export type AdapterCall
  = | { hook: 'register' }
    | { hook: 'unregister' }
    | { hook: 'onLayerAdded'; layerId: string; state: ReportedState }
    | { hook: 'onLayerRemoved'; layerId: string }
    | { hook: 'onVisibilityChanged'; layerId: string; visible: boolean }
    | { hook: 'onEnabledChanged'; layerId: string; enabled: boolean }
    | { hook: 'onOpacityChanged'; layerId: string; opacity: number; computedOpacity: number }
    | { hook: 'onTimeInfoChanged'; layerId: string; timeInfo: LayerTimeInfo }
    | { hook: 'onLayerDataChanged'; layerId: string }
    | { hook: 'onOrderChanged'; layerOrder: string[] }
    | { hook: 'onLayerMoved'; layerId: string; parentId: string | null };

export interface ContractMonitor<TLayer, TGroup> {
  /** Pass this to `setAdapter` in place of the adapter it wraps. */
  adapter: LayerManagerAdapter<TLayer, TGroup>;
  /** Throws a descriptive error if the manager broke a guarantee of the adapter contract. */
  assertMet: () => void;
}

/**
 * Wraps an adapter, records every call the manager makes on it and forwards the call.
 * `assertMet` checks the recorded calls against the adapter contract in
 * docs/adapters/writing-an-adapter.md. Free of any test runner.
 */
export function monitorContract<TLayer, TGroup>(inner: LayerManagerAdapter<TLayer, TGroup>): ContractMonitor<TLayer, TGroup> {
  const calls: AdapterCall[] = [];

  const adapter: LayerManagerAdapter<TLayer, TGroup> = {
    register: () => {
      calls.push({ hook: 'register' });
      inner.register?.();
    },
    unregister: () => {
      calls.push({ hook: 'unregister' });
      inner.unregister?.();
    },
    onLayerAdded: (info) => {
      const { layerId, parentId, visible, enabled, opacity, computedOpacity, timeInfo } = info;
      calls.push({ hook: 'onLayerAdded', layerId, state: { parentId, visible, enabled, opacity, computedOpacity, timeInfo } });
      inner.onLayerAdded?.(info);
    },
    onLayerRemoved: (layerId) => {
      calls.push({ hook: 'onLayerRemoved', layerId });
      inner.onLayerRemoved?.(layerId);
    },
    onVisibilityChanged: (info, visible) => {
      calls.push({ hook: 'onVisibilityChanged', layerId: info.layerId, visible });
      inner.onVisibilityChanged?.(info, visible);
    },
    onEnabledChanged: (info, enabled) => {
      calls.push({ hook: 'onEnabledChanged', layerId: info.layerId, enabled });
      inner.onEnabledChanged?.(info, enabled);
    },
    onOpacityChanged: (info, computedOpacity) => {
      calls.push({ hook: 'onOpacityChanged', layerId: info.layerId, opacity: info.opacity, computedOpacity });
      inner.onOpacityChanged?.(info, computedOpacity);
    },
    onTimeInfoChanged: (info, timeInfo) => {
      calls.push({ hook: 'onTimeInfoChanged', layerId: info.layerId, timeInfo });
      inner.onTimeInfoChanged?.(info, timeInfo);
    },
    onLayerDataChanged: (info) => {
      calls.push({ hook: 'onLayerDataChanged', layerId: info.layerId });
      inner.onLayerDataChanged?.(info);
    },
    onOrderChanged: (layerOrder) => {
      calls.push({ hook: 'onOrderChanged', layerOrder: [...layerOrder] });
      inner.onOrderChanged?.(layerOrder);
    },
    onLayerMoved: (info) => {
      calls.push({ hook: 'onLayerMoved', layerId: info.layerId, parentId: info.parentId });
      inner.onLayerMoved?.(info);
    },
  };

  return {
    adapter,
    assertMet: () => {
      const broken = checkContract(calls);
      if (broken.length > 0) {
        throw new Error(broken.join('\n'));
      }
    },
  };
}

/** Describes each guarantee of the adapter contract that the recorded calls break. */
export function checkContract(calls: AdapterCall[]): string[] {
  return [...checkAddedFirst(calls), ...checkOrderFollowsChanges(calls), ...checkNoRepeats(calls)];
}

/** `onLayerAdded` comes first for any layer, and nothing arrives after `onLayerRemoved` or `unregister`. */
function checkAddedFirst(calls: AdapterCall[]): string[] {
  const broken: string[] = [];
  const known = new Set<string>();
  let detached = false;
  for (const call of calls) {
    if (call.hook === 'register' || call.hook === 'unregister') {
      detached = call.hook === 'unregister';
      known.clear();
      continue;
    }
    if (detached) {
      broken.push(`${call.hook} after unregister`);
      continue;
    }
    switch (call.hook) {
      case 'onLayerAdded':
        if (known.has(call.layerId)) {
          broken.push(`onLayerAdded for layer ${call.layerId}, which was already added`);
        }
        known.add(call.layerId);
        break;
      case 'onOrderChanged':
        break;
      default:
        if (!known.has(call.layerId)) {
          broken.push(`${call.hook} for layer ${call.layerId}, which the adapter was not told about or was told was removed`);
        }
        if (call.hook === 'onLayerRemoved') {
          known.delete(call.layerId);
        }
    }
  }
  return broken;
}

/** After every add or remove, `onOrderChanged` comes next and lists exactly the current layers. */
function checkOrderFollowsChanges(calls: AdapterCall[]): string[] {
  const broken: string[] = [];
  const current = new Set<string>();
  let pending = false;
  for (const call of attachedCalls(calls)) {
    switch (call.hook) {
      case 'register':
        break;
      case 'unregister':
        current.clear();
        pending = false;
        break;
      case 'onLayerAdded':
        current.add(call.layerId);
        pending = true;
        break;
      case 'onLayerRemoved':
        current.delete(call.layerId);
        pending = true;
        break;
      case 'onOrderChanged':
        if (!listsExactly(call.layerOrder, current)) {
          broken.push(`onOrderChanged listed [${call.layerOrder.join(', ')}], but the current layers are [${[...current].join(', ')}]`);
        }
        pending = false;
        break;
      default:
        if (pending) {
          broken.push(`${call.hook} for layer ${call.layerId} before onOrderChanged reported the last add or remove`);
        }
    }
  }
  if (pending) {
    broken.push('the last add or remove was never followed by onOrderChanged');
  }
  return broken;
}

/** No call repeats a value the adapter already has. New layer data is the exception. */
function checkNoRepeats(calls: AdapterCall[]): string[] {
  const broken: string[] = [];
  const reported = new Map<string, ReportedState>();
  let previousOrder = '';
  let currentOrder = '';

  function report(layerId: string, isRepeat: (state: ReportedState) => boolean, update: Partial<ReportedState>, repeat: string): void {
    const state = reported.get(layerId);
    if (state && isRepeat(state)) {
      broken.push(repeat);
    }
    if (state) {
      Object.assign(state, update);
    }
  }

  for (const call of attachedCalls(calls)) {
    switch (call.hook) {
      case 'unregister':
        reported.clear();
        break;
      case 'onLayerAdded':
        reported.set(call.layerId, { ...call.state });
        break;
      case 'onLayerRemoved':
        reported.delete(call.layerId);
        break;
      case 'onOrderChanged':
        previousOrder = currentOrder;
        currentOrder = call.layerOrder.join();
        break;
      case 'onVisibilityChanged':
        report(call.layerId, (state) => state.visible === call.visible, { visible: call.visible }, `onVisibilityChanged for layer ${call.layerId} repeated visible ${call.visible}`);
        break;
      case 'onEnabledChanged':
        report(call.layerId, (state) => state.enabled === call.enabled, { enabled: call.enabled }, `onEnabledChanged for layer ${call.layerId} repeated enabled ${call.enabled}`);
        break;
      case 'onOpacityChanged':
        report(call.layerId, (state) => state.opacity === call.opacity && state.computedOpacity === call.computedOpacity, { opacity: call.opacity, computedOpacity: call.computedOpacity }, `onOpacityChanged for layer ${call.layerId} repeated opacity ${call.opacity} and computed opacity ${call.computedOpacity}`);
        break;
      case 'onTimeInfoChanged':
        report(call.layerId, (state) => isSameTimeInfo(state.timeInfo, call.timeInfo), { timeInfo: call.timeInfo }, `onTimeInfoChanged for layer ${call.layerId} repeated the same time info`);
        break;
      case 'onLayerMoved':
        report(call.layerId, (state) => state.parentId === call.parentId && previousOrder === currentOrder, { parentId: call.parentId }, `onLayerMoved for layer ${call.layerId} changed neither its parent nor the order`);
        break;
    }
  }
  return broken;
}

/** The calls made while the adapter was attached. `register` and `unregister` stay in, so a check can start again. */
function attachedCalls(calls: AdapterCall[]): AdapterCall[] {
  let detached = false;
  return calls.filter((call) => {
    if (call.hook === 'register' || call.hook === 'unregister') {
      detached = call.hook === 'unregister';
      return true;
    }
    return !detached;
  });
}

function listsExactly(layerOrder: string[], layerIds: Set<string>): boolean {
  return layerOrder.length === layerIds.size && layerOrder.every((layerId) => layerIds.has(layerId));
}
