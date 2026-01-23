import { useCallback } from 'react';

import { useToast } from '@/components/atoms/Toasts/useToast';
import Typography from '@/components/atoms/Typography';
import { AddLayerParams } from '@/lib/machines/layerManager/types';
import { resetTooltipIfParent } from '@/lib/store/features/tooltip/tooltipSlice';
import { useAppDispatch } from '@/lib/store/hooks';

import { LayerData, LayerManagerContext } from './LayerManagerProvider';

function useAddLayerToMap() {
  const layerManagerMachine = LayerManagerContext.useActorRef();
  const { toast } = useToast();

  return useCallback(
    ({ config, fireToast = false }: { config: AddLayerParams<LayerData>; fireToast?: boolean }) => {
      layerManagerMachine.send({
        type: 'LAYER.ADD',
        params: {
          ...config,
          visible: config.visible ?? true,
        },
      });
      if (fireToast) {
        toast({
          title: 'Layer Added',
          description: (
            <>
              <Typography as="span" className="break-all">
                {config.layerConfig.layerName}
              </Typography>{' '}
              has been added to the map
            </>
          ),
          duration: 2000,
        });
      }
    },
    [layerManagerMachine, toast],
  );
}

function useRemoveLayerFromMap() {
  const layerManagerMachine = LayerManagerContext.useActorRef();
  const { toast } = useToast();
  const dispatch = useAppDispatch();

  return useCallback(
    ({ layerId, fireToast = false }: { layerId: string; fireToast?: boolean }) => {
      dispatch(resetTooltipIfParent(layerId));
      layerManagerMachine.send({
        type: 'LAYER.REMOVE',
        layerId,
      });
      if (fireToast) {
        const layerActor = layerManagerMachine
          .getSnapshot()
          .context.layers.find((layer) => layer.layerActor.id === layerId);

        if (!layerActor) {
          return;
        }

        const { layerName } = layerActor.layerActor.getSnapshot().context;

        toast({
          title: 'Layer removed',
          description: (
            <>
              <Typography as="span" className="break-all">
                {layerName}
              </Typography>{' '}
              has been removed from the map
            </>
          ),
          duration: 2000,
        });
      }
    },
    [layerManagerMachine, toast, dispatch],
  );
}

// export function that returns an object with the add and remove layer functions
export function useLayerOperations() {
  return {
    addLayerToMap: useAddLayerToMap(),
    removeLayerFromMap: useRemoveLayerFromMap(),
  };
}
