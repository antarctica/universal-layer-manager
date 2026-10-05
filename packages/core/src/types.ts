import type { Temporal } from 'temporal-spec';
import type { ActorRef, ActorRefFrom, Snapshot } from 'xstate';

import type { layerGroupMachine } from './layerMachines/layerGroupMachine';
import type { layerMachine } from './layerMachines/layerMachine';

// ============================================================================
// DOMAIN: TIME
// Value objects and guards for handling temporal data.
// ============================================================================

type DateValue = Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;

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

export type LayerStateTag = 'enabled' | 'visible';

export type LayerStartState = 'enabled.hidden' | 'disabled';

export interface BaseLayerConfig<T> {
  layerId: string;
  layerName: string;
  parentId?: string | null;
  layerData: T;
  timeInfo?: LayerTimeInfo;
  opacity?: number;
}

export interface LayerConfig<TLayer> extends BaseLayerConfig<TLayer> {
  layerType: 'layer';
  listMode?: 'show' | 'hide';
}

export interface LayerGroupConfig<TLayer, TGroup = TLayer> extends BaseLayerConfig<TGroup> {
  layerType: 'layerGroup';
  listMode?: 'show' | 'hide' | 'hide-children';
}

interface BaseAddLayerParams {
  visible?: boolean;
  enabled?: boolean;
  index?: number;
  position?: 'top' | 'bottom';
}

export interface AddLayerParams<TLayer> extends BaseAddLayerParams {
  layerConfig: LayerConfig<TLayer>;
}

export interface AddGroupLayerParams<TGroup> extends BaseAddLayerParams {
  layerConfig: LayerGroupConfig<TGroup>;
}

export type AddManagedLayerParams<TLayer, TGroup = TLayer> = AddLayerParams<TLayer> | AddGroupLayerParams<TGroup>;

export interface MoveLayerTarget {
  parentId: string | null;
  index?: number;
  position?: 'top' | 'bottom';
}

export interface MoveLayerParams extends MoveLayerTarget {
  layerId: string;
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
    | { type: 'LAYER.SHOW' }
    | { type: 'LAYER.START_SHOWING' }
    | { type: 'PARENT.VISIBLE' }
    | { type: 'PARENT.HIDDEN' }
    | { type: 'PARENT.OPACITY_CHANGED'; opacity: number }
    | { type: 'PARENT.CHANGED'; parentRef: ParentLayerActor | null; parentOpacity: number; parentVisible: boolean };

export type ParentEvent
  = | { type: 'CHILD.VISIBLE'; layerId: string }
    | { type: 'LAYERS.CHILDREN_CHANGED'; children: ChildLayerActor[]; childLayerOrder: string[] };

// --- Machine Specific Events ---

export type LayerEvent<TLayer> = ChildEvent | LayerEventBase<TLayer>;

export type LayerGroupEvent<TGroup> = ChildEvent | ParentEvent | LayerEventBase<TGroup>;

// --- Manager Events (Inputs & Outputs) ---

export type LayerManagerEvent<TLayer, TGroup = TLayer>
  = | { type: 'LAYER.ADD'; params: AddManagedLayerParams<TLayer, TGroup> }
    | { type: 'LAYER.REMOVE'; layerId: string }
    | ({ type: 'LAYER.MOVE' } & MoveLayerParams)
    | { type: 'RESET' };

/** Notifications that layer and group actors send to their manager. Not for callers. */
export type LayerManagerChildEvent<TLayer, TGroup = TLayer>
  = | { type: 'CHILD.VISIBILITY_CHANGED'; layerId: string; visible: boolean }
    | { type: 'CHILD.ENABLED_CHANGED'; layerId: string; enabled: boolean }
    | { type: 'CHILD.OPACITY_CHANGED'; layerId: string; opacity: number; computedOpacity: number }
    | { type: 'CHILD.TIME_INFO_CHANGED'; layerId: string; timeInfo: LayerTimeInfo }
    | { type: 'CHILD.LAYER_DATA_CHANGED'; layerId: string; layerData: TLayer | TGroup }
    | { type: 'CHILD.REJECTED'; layerId: string; reason: string };

export type LayerManagerEmittedEvent<TLayer, TGroup = TLayer>
  = | { type: 'LAYER.ADDED'; layerId: string }
    | { type: 'LAYER.REMOVED'; layerId: string }
    | { type: 'LAYER.ORDER_CHANGED'; layerOrder: string[] }
    | { type: 'LAYER.MOVED'; layerId: string; parentId: string | null }
    | { type: 'LAYER.VISIBILITY_CHANGED'; layerId: string; visible: boolean }
    | { type: 'LAYER.ENABLED_CHANGED'; layerId: string; enabled: boolean }
    | { type: 'LAYER.OPACITY_CHANGED'; layerId: string; opacity: number; computedOpacity: number }
    | { type: 'LAYER.TIME_INFO_CHANGED'; layerId: string; timeInfo: LayerTimeInfo }
    | { type: 'LAYER.LAYER_DATA_CHANGED'; layerId: string; layerData: TLayer | TGroup }
    | { type: 'LAYER.REJECTED'; layerId: string; reason: string };

// ============================================================================
// DOMAIN: ACTOR SYSTEM
// Type definitions for the actors and machines.
// ============================================================================

// Generic Actor References
export type LayerManagerRef<TLayer, TGroup = TLayer> = ActorRef<Snapshot<unknown>, LayerManagerChildEvent<TLayer, TGroup>>;
export type ParentLayerSnapshot = Snapshot<unknown> & {
  context: Pick<LayerContextBase<unknown>, 'layerId' | 'computedOpacity'>;
  hasTag: (tag: LayerStateTag) => boolean;
};
export type ParentLayerActor = ActorRef<ParentLayerSnapshot, ParentEvent>;

export type ChildLayerSnapshot = Snapshot<unknown> & {
  context: Pick<LayerContextBase<unknown>, 'layerId'>;
};
export type ChildLayerActor = ActorRef<ChildLayerSnapshot, ChildEvent>;

// Concrete Machine Actors
export type LayerMachineActor<TLayer = unknown, TGroup = undefined> = ActorRefFrom<ReturnType<typeof layerMachine<TLayer, TGroup>>>;
export type LayerGroupMachineActor<TLayer = unknown, TGroup = undefined> = ActorRefFrom<ReturnType<typeof layerGroupMachine<TLayer, TGroup>>>;
export type LayerActor<TLayer = unknown, TGroup = undefined> = LayerMachineActor<TLayer, TGroup> | LayerGroupMachineActor<TLayer, TGroup>;

// ============================================================================
// DOMAIN: CONTEXT (STATE)
// The internal state models of the actors.
// ============================================================================

export interface LayerContextBase<TLayer, TGroup = TLayer> {
  layerManagerRef: LayerManagerRef<TLayer, TGroup>;
  parentRef: ParentLayerActor | null;
  layerId: string;
  layerName: string;
  layerType: LayerType;
  layerData: TLayer | TGroup;
  timeInfo?: LayerTimeInfo;
  opacity: number;
  parentOpacity: number;
  computedOpacity: number;
  startState: LayerStartState;
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
  /** The manager's order of this group's children, bottom first. Set only by the manager. */
  childLayerOrder: string[];
  listMode: 'show' | 'hide' | 'hide-children';
}

export interface LayerManagerContext<TLayer, TGroup = TLayer> {
  layers: ManagedItem<TLayer, TGroup>[];
  childLayerOrder: string[];
  groupChildLayerOrder: Record<string, string[]>;
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
