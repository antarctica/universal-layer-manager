import React from 'react';

import {
  ILPLayerGroupMachineActor,
  ILPLayerMachineActor,
} from '@/components/map/layerManager/types';
import { useLayerGroupChildLayers } from '@/lib/machines/layerManager/hooks/baseSelectors';

export function useVisibleWFSSARLayers(wfsSarLayers: ILPLayerMachineActor[]) {
  const [visibleLayers, setVisibleLayers] = React.useState<ILPLayerMachineActor[]>([]);

  React.useEffect(() => {
    // get the visible layers
    function getVisibleLayers() {
      return wfsSarLayers.filter((layerActor) => {
        const snapshot = layerActor.getSnapshot();
        const isVisible = snapshot.matches({ enabled: 'visible' });
        const layerData = snapshot.context.layerData;
        return isVisible && layerData?.layerSourceType === 'wfs-sar';
      });
    }

    setVisibleLayers(getVisibleLayers());

    const subscriptions = wfsSarLayers.map((layerActor) =>
      layerActor.subscribe(() => setVisibleLayers(getVisibleLayers())),
    );

    return () => {
      subscriptions.forEach((subscription) => subscription.unsubscribe());
    };
  }, [wfsSarLayers]);

  return visibleLayers;
}

export function useLayerGroupChildLayersInDisplayOrder(layerGroupActor: ILPLayerGroupMachineActor) {
  const layers = useLayerGroupChildLayers(layerGroupActor);
  return [...layers].reverse();
}
