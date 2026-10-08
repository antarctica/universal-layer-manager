import type { SingleTimeInfo } from '@ulm/core';
import * as React from 'react';
import { Temporal } from 'temporal-polyfill';
import { useLayerManager } from '../layers/LayerManagerProvider';
import styles from './LayerList.module.css';

// The day a time-aware layer shows. Picking another day sets the layer's time info, and the map follows.
export function LayerDateInput({ layerId, timeInfo }: { layerId: string; timeInfo: SingleTimeInfo }): React.ReactElement {
  const manager = useLayerManager();
  const today = Temporal.Now.plainDateISO('UTC');

  return (
    <label className={styles.dateControls}>
      <span>Date</span>
      <input
        type="date"
        value={Temporal.PlainDate.from(timeInfo.value).toString()}
        max={today.toString()}
        required
        onChange={(event) => {
          if (event.target.value) {
            manager.setTimeInfo(layerId, { ...timeInfo, value: Temporal.PlainDate.from(event.target.value) });
          }
        }}
      />
    </label>
  );
}
