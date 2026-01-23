import { LayerManagerActor } from '@/lib/machines/layerManager/layerManagerMachine';
import { LayerGroupMachineActor, LayerMachineActor } from '@/lib/machines/layerManager/types';

import { LayerData } from './LayerManagerProvider';

export type ILPLayerManagerActor = LayerManagerActor<LayerData>;

export type ILPLayerGroupMachineActor = LayerGroupMachineActor<LayerData>;

export type ILPLayerMachineActor = LayerMachineActor<LayerData>;
