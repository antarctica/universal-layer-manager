import type { DateValue } from '@internationalized/date';
import type { ActorRef, ActorRefFrom, Snapshot } from 'xstate';

import type { layerGroupMachine } from './layerMachines/layerGroupMachine';
import type { layerMachine } from './layerMachines/layerMachine';

// ============================================================================
// DOMAIN: TIME
// Value objects and guards for handling temporal data.
// ============================================================================

export interface BaseTimeInfo {
  precision: 'date' | 'datetime';
}

/** Single point in time */
export interface SingleTimeInfo extends BaseTimeInfo {
  type: 'single';
  value: DateValue;
}

export function isSingleTimeInfo(timeInfo?: LayerTimeInfo): timeInfo is SingleTimeInfo {
  return timeInfo?.type === 'single';
}

/** Duration or span of time */
export interface RangeTimeInfo extends BaseTimeInfo {
  type: 'range';
  start: DateValue;
  end: DateValue;
}

export function isRangeTimeInfo(timeInfo?: LayerTimeInfo): timeInfo is RangeTimeInfo {
  return timeInfo?.type === 'range';
}

export type LayerTimeInfo = BaseTimeInfo & (SingleTimeInfo | RangeTimeInfo);

// ============================================================================
// DOMAIN: CONFIGURATION (API)
// The static blueprints used to initialize layers.
// ============================================================================

export type LayerType = 'layer' | 'layerGroup';

export interface BaseLayerConfig<T> {
  layerId: string;
  layerName: string;
  parentId: string | null;
  layerData: T;
  timeInfo?: LayerTimeInfo;
  opacity?: number;
}

export interface LayerConfig<TLayer> extends BaseLayerConfig<TLayer> {
  layerType: 'layer';
}

export interface LayerGroupConfig<TLayer, TGroup = TLayer> extends BaseLayerConfig<TGroup> {
  layerType: 'layerGroup';
  listMode?: 'show' | 'hide' | 'hide-children';
}

export interface AddLayerParams<TLayer, TGroup = TLayer> {
  layerConfig: LayerConfig<TLayer> | LayerGroupConfig<TLayer, TGroup>;
  visible?: boolean;
  enabled?: boolean;
  index?: number;
  position?: 'top' | 'bottom';
}

// ============================================================================
// DOMAIN: EVENTS
// Communication messages between actors.
// ============================================================================

// --- Shared Primitives ---

export type LayerEventBase<T>
  = | { type: 'LAYER.SET_OPACITY'; opacity: number }
    | { type: 'LAYER.SET_TIME_INFO'; timeInfo: LayerTimeInfo }
    | { type: 'LAYER.SET_LAYER_DATA'; layerData: T };

export type ChildEvent
  = | { type: 'LAYER.ENABLED' }
    | { type: 'LAYER.DISABLED' }
    | { type: 'PARENT.VISIBLE' }
    | { type: 'PARENT.HIDDEN' };

export type ParentEvent
  = | { type: 'CHILD.VISIBLE'; layerId: string }
    | { type: 'LAYERS.ADD_CHILD'; child: ChildLayerActor; index?: number; position?: 'top' | 'bottom' }
    | { type: 'LAYERS.REMOVE_CHILD'; id: string };

// --- Machine Specific Events ---

export type LayerEvent<TLayer> = ChildEvent | LayerEventBase<TLayer>;

export type LayerGroupEvent<TGroup> = ChildEvent | ParentEvent | LayerEventBase<TGroup>;

// --- Manager Events (Inputs & Outputs) ---

export type LayerManagerEvent<TLayer, TGroup = TLayer>
  = | { type: 'LAYER.ADD'; params: AddLayerParams<TLayer, TGroup> }
    | { type: 'LAYER.REMOVE'; layerId: string }
    | { type: 'LAYER.UPDATE_VISIBILITY'; layerId: string; visible: boolean }
    | { type: 'LAYER.UPDATE_OPACITY'; layerId: string; opacity: number }
    | { type: 'LAYER.UPDATE_TIME_INFO'; layerId: string; timeInfo: LayerTimeInfo }
    | { type: 'LAYER.UPDATE_LAYER_DATA'; layerId: string; layerData: TLayer | TGroup }
    | { type: 'RESET' };

export type LayerManagerEmittedEvent<TLayer, TGroup = TLayer>
  = | { type: 'LAYER.ADDED'; layerId: string; visible: boolean }
    | { type: 'LAYER.REMOVED'; layerId: string }
    | { type: 'LAYER.ORDER_CHANGED'; layerOrder: string[] }
    | { type: 'LAYER.VISIBILITY_CHANGED'; layerId: string; visible: boolean }
    | { type: 'LAYER.OPACITY_CHANGED'; layerId: string; opacity: number }
    | { type: 'LAYER.TIME_INFO_CHANGED'; layerId: string; timeInfo: LayerTimeInfo }
    | { type: 'LAYER.LAYER_DATA_CHANGED'; layerId: string; layerData: TLayer | TGroup };

// ============================================================================
// DOMAIN: ACTOR SYSTEM
// Type definitions for the actors and machines.
// ============================================================================

// Generic Actor References
export type LayerManager<TLayer, TGroup = TLayer> = ActorRef<Snapshot<unknown>, LayerManagerEvent<TLayer, TGroup>>;
export type ParentLayerActor = ActorRef<Snapshot<unknown>, ParentEvent>;
export type ChildLayerActor = ActorRef<Snapshot<unknown>, ChildEvent>;

// Concrete Machine Actors
export type LayerMachineActor<TLayer = any, TGroup = any> = ActorRefFrom<ReturnType<typeof layerMachine<TLayer, TGroup>>>;
export type LayerGroupMachineActor<TLayer = any, TGroup = any> = ActorRefFrom<ReturnType<typeof layerGroupMachine<TLayer, TGroup>>>;
export type LayerActor<TLayer = any, TGroup = any> = LayerMachineActor<TLayer, TGroup> | LayerGroupMachineActor<TLayer, TGroup>;

// ============================================================================
// DOMAIN: CONTEXT (STATE)
// The internal state models of the actors.
// ============================================================================

export interface LayerContextBase<TLayer, TGroup = TLayer> {
  layerManagerRef: LayerManager<TLayer, TGroup>;
  parentRef: ParentLayerActor | null;
  layerId: string;
  layerName: string;
  layerType: LayerType;
  layerData: TLayer | TGroup;
  timeInfo?: LayerTimeInfo;
  opacity: number;
}

export interface LayerContext<TLayer, TGroup = TLayer> extends LayerContextBase<TLayer, TGroup> {
  layerType: 'layer';
  layerData: TLayer;
  listMode: 'show' | 'hide';
}

export interface LayerGroupContext<TLayer, TGroup = TLayer> extends LayerContextBase<TLayer, TGroup> {
  layerType: 'layerGroup';
  layerData: TGroup;
  children: ChildLayerActor[];
  childLayerOrder: string[];
  listMode: 'show' | 'hide' | 'hide-children';
}

export interface LayerManagerContext<TLayer, TGroup = TLayer> {
  layers: ManagedItem<TLayer, TGroup>[];
  childLayerOrder: string[];
  allowNestedGroupLayers: boolean;
}

// ============================================================================
// DOMAIN: RUNTIME HELPERS
// Wrappers and Type Guards for runtime logic.
// ============================================================================

// Wrappers
export interface ManagedLayer<TLayer, TGroup = TLayer> {
  type: 'layer';
  layerActor: LayerMachineActor<TLayer, TGroup>;
}

export interface ManagedLayerGroup<TLayer, TGroup = TLayer> {
  type: 'layerGroup';
  layerActor: LayerGroupMachineActor<TLayer, TGroup>;
}

export type ManagedItem<TLayer, TGroup = TLayer> = ManagedLayer<TLayer, TGroup> | ManagedLayerGroup<TLayer, TGroup>;

// Type Guards
export function isLayerMachine<TLayer, TGroup = TLayer>(layer: LayerActor<TLayer, TGroup>): layer is LayerMachineActor<TLayer, TGroup> {
  return layer.getSnapshot().context.layerType === 'layer';
}

export function isLayerGroupMachine<TLayer, TGroup = TLayer>(layer: LayerActor<TLayer, TGroup>): layer is LayerGroupMachineActor<TLayer, TGroup> {
  return layer.getSnapshot().context.layerType === 'layerGroup';
}
