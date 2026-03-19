import type {
  LayerGroupMachineActor,
  LayerMachineActor,
} from '@ulm/core';
import type * as L from 'leaflet';

import type { SnapshotFrom } from 'xstate';
import { LayerManager } from '@ulm/core';
import { useSelector } from '@xstate/react';
import * as React from 'react';
import { createContext, useContext, useRef } from 'react';

// Extra data we store on each managed layer in this example.
export interface LayerData {
  leafletLayer: L.Layer;
}

export type ClientLayerGroupMachineActor = LayerGroupMachineActor<LayerData, undefined>;
export type ClientLayerMachineActor = LayerMachineActor<LayerData, undefined>;

type Manager = LayerManager<LayerData, undefined>;

const LayerManagerCtx = createContext<Manager | null>(null);

function useLayerManagerContext(): Manager {
  const manager = useContext(LayerManagerCtx);
  if (!manager) {
    throw new Error(
      `You used a hook from "LayerManagerProvider" but it's not inside a <LayerManagerProvider>.`,
    );
  }
  return manager;
}

/** Returns the stable LayerManager instance. Use this to send commands. */
export function useLayerManager(): Manager {
  return useLayerManagerContext();
}

/**
 * Subscribes to the LayerManager's XState actor and returns a derived value.
 * The component only re-renders when the selected value changes.
 */
export function useLayerManagerSelector<T>(
  selector: (snapshot: SnapshotFrom<NonNullable<Manager['actor']>>) => T,
  compare?: (a: T, b: T) => boolean,
): T {
  const manager = useLayerManagerContext();
  // actor is always non-null after LayerManager construction
  return useSelector(manager.actor!, selector, compare);
}

export const LayerManagerProvider = React.memo(
  ({ children }: { children: React.ReactNode }) => {
    const managerRef = useRef<Manager | null>(null);
    if (!managerRef.current) {
      managerRef.current = new LayerManager<LayerData, undefined>({
        allowNestedGroupLayers: true,
      });
    }

    return (
      <LayerManagerCtx.Provider value={managerRef.current}>
        {children}
      </LayerManagerCtx.Provider>
    );
  },
);
