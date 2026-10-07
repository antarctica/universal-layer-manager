import type { LayerContextBase, LayerTimeInfo, ParentLayerActor } from '../types';
import { getOpacityRejection } from '../utils';

type LayerIdentity = Pick<LayerContextBase<unknown>, 'layerId'>;

export function visibilityChange(context: LayerIdentity, visible: boolean) {
  return {
    notification: { type: 'CHILD.VISIBILITY_CHANGED' as const, layerId: context.layerId, visible },
  };
}

export function enabledChange(context: LayerIdentity, enabled: boolean) {
  return {
    notification: { type: 'CHILD.ENABLED_CHANGED' as const, layerId: context.layerId, enabled },
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

export function opacityRejection(context: LayerIdentity, opacity: number) {
  return {
    notification: { type: 'CHILD.REJECTED' as const, layerId: context.layerId, reason: getOpacityRejection(context.layerId, opacity) ?? '' },
  };
}

export function parentOpacityChange(context: LayerIdentity & Pick<LayerContextBase<unknown>, 'opacity'>, parentOpacity: number) {
  const computedOpacity = parentOpacity * context.opacity;
  return {
    update: { parentOpacity, computedOpacity },
    notification: { type: 'CHILD.OPACITY_CHANGED' as const, layerId: context.layerId, opacity: context.opacity, computedOpacity },
  };
}

export function parentChange(
  context: LayerIdentity & Pick<LayerContextBase<unknown>, 'opacity' | 'computedOpacity'>,
  parentRef: ParentLayerActor | null,
  parentOpacity: number,
) {
  const { update, notification } = parentOpacityChange(context, parentOpacity);
  return {
    update: { ...update, parentRef },
    notification: update.computedOpacity === context.computedOpacity ? undefined : notification,
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
