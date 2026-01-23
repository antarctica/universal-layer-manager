import { GroupLayer } from '@/lib/types';

import { LayerManagerContext } from '../LayerManagerProvider';

export function useIsMapInitialisedWithLayers(initialLayerConfig: GroupLayer[]) {
  const layers = LayerManagerContext.useSelector(({ context }) => context.layers);
  const mapLayersInitialised =
    layers.length >= initialLayerConfig.reduce((acc, group) => acc + group.layers.length, 0) + 1;

  return mapLayersInitialised;
}
