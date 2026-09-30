import type { LayerContextBase, LayerTimeInfo } from '../types';

type LayerIdentity = Pick<LayerContextBase<unknown>, 'layerId'>;

export function visibilityChange(context: LayerIdentity, visible: boolean) {
  return {
    notification: { type: 'CHILD.VISIBILITY_CHANGED' as const, layerId: context.layerId, visible },
  };
}

export function childVisibleNotice(context: LayerIdentity) {
  return { type: 'CHILD.VISIBLE' as const, layerId: context.layerId };
}

export function ownOpacityChange(context: LayerIdentity & Pick<LayerContextBase<unknown>, 'parentOpacity'>, opacity: number) {
  const computedOpacity = context.parentOpacity * opacity;
  return {
    update: { opacity, computedOpacity },
    notification: { type: 'CHILD.OPACITY_CHANGED' as const, layerId: context.layerId, opacity, computedOpacity },
  };
}

export function parentOpacityChange(context: LayerIdentity & Pick<LayerContextBase<unknown>, 'opacity'>, parentOpacity: number) {
  const computedOpacity = parentOpacity * context.opacity;
  return {
    update: { parentOpacity, computedOpacity },
    notification: { type: 'CHILD.OPACITY_CHANGED' as const, layerId: context.layerId, opacity: context.opacity, computedOpacity },
  };
}

export function timeInfoChange(context: LayerIdentity, timeInfo: LayerTimeInfo) {
  return {
    update: { timeInfo },
    notification: { type: 'CHILD.TIME_INFO_CHANGED' as const, layerId: context.layerId, timeInfo },
  };
}

export function layerDataChange<TData>(context: LayerIdentity, layerData: TData) {
  return {
    update: { layerData },
    notification: { type: 'CHILD.LAYER_DATA_CHANGED' as const, layerId: context.layerId, layerData },
  };
}
