import type { Temporal } from 'temporal-spec';
import type { ActorRef, ActorRefFrom, Snapshot } from 'xstate';

import type { layerGroupMachine } from './layerMachines/layerGroupMachine';
import type { layerMachine } from './layerMachines/layerMachine';

// ============================================================================
// TIME
// The time a layer shows: a single date or a range, and guards to tell them apart.
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

/** Duration or span of time */
export interface RangeTimeInfo extends BaseTimeInfo {
  type: 'range';
  start: DateValue;
  end: DateValue;
}

export type LayerTimeInfo = BaseTimeInfo & (SingleTimeInfo | RangeTimeInfo);

export function isSingleTimeInfo(timeInfo?: LayerTimeInfo): timeInfo is SingleTimeInfo {
  return timeInfo?.type === 'single';
}

export function isRangeTimeInfo(timeInfo?: LayerTimeInfo): timeInfo is RangeTimeInfo {
  return timeInfo?.type === 'range';
}

// ============================================================================
// LAYER CONFIGURATION
// What a caller gives to add a layer or group.
// ============================================================================

export type LayerType = 'layer' | 'layerGroup';

/** `layerData` may be left out when its type allows `undefined`, such as groups that carry no data. */
export type LayerDataField<T> = undefined extends T ? { layerData?: T } : { layerData: T };

export type BaseLayerConfig<T> = LayerDataField<T> & {
  layerId: string;
  layerName: string;
  parentId?: string | null;
  timeInfo?: LayerTimeInfo;
  opacity?: number;
};

export type LayerConfig<TLayer> = BaseLayerConfig<TLayer> & {
  layerType: 'layer';
  listMode?: 'show' | 'hide';
};

export type LayerGroupConfig<TGroup = undefined> = BaseLayerConfig<TGroup> & {
  layerType: 'layerGroup';
  listMode?: 'show' | 'hide' | 'hide-children';
};

// ============================================================================
// ADD AND MOVE PARAMETERS
// Where a new or moved layer goes, and how a new one starts.
// ============================================================================

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

export type AddManagedLayerParams<TLayer, TGroup = undefined> = AddLayerParams<TLayer> | AddGroupLayerParams<TGroup>;

export interface MoveLayerTarget {
  parentId: string | null;
  index?: number;
  position?: 'top' | 'bottom';
}

export interface MoveLayerParams extends MoveLayerTarget {
  layerId: string;
}

// ============================================================================
// COMMANDS AND EMITTED EVENTS
// The events a caller sends to the actors, and the events the manager emits.
// ============================================================================

/** The commands a caller can send to a layer or group actor. `TData` is the layer's or group's data type. */
export type LayerCommandEvent<TData>
  = | { type: 'LAYER.ENABLED' }
    | { type: 'LAYER.DISABLED' }
    | { type: 'LAYER.SHOW' }
    | { type: 'LAYER.SET_OPACITY'; opacity: number }
    | { type: 'LAYER.SET_TIME_INFO'; timeInfo: LayerTimeInfo }
    | { type: 'LAYER.SET_LAYER_DATA'; layerData: TData };

/** The commands a caller can send to the manager actor. */
export type LayerManagerEvent<TLayer, TGroup = undefined>
  = | { type: 'LAYER.ADD'; params: AddManagedLayerParams<TLayer, TGroup> }
    | { type: 'LAYER.REMOVE'; layerId: string }
    | ({ type: 'LAYER.MOVE' } & MoveLayerParams)
    | { type: 'RESET' };

/** The events the manager actor emits for each change. Listen with `actor.on`. */
export type LayerManagerEmittedEvent<TLayer, TGroup = undefined>
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
// ACTORS
// The layer and group actors, the manager's items that hold them, and guards to tell them apart.
// ============================================================================

export type LayerMachineActor<TLayer = unknown, TGroup = undefined> = ActorRefFrom<ReturnType<typeof layerMachine<TLayer, TGroup>>>;
export type LayerGroupMachineActor<TLayer = unknown, TGroup = undefined> = ActorRefFrom<ReturnType<typeof layerGroupMachine<TLayer, TGroup>>>;
export type LayerActor<TLayer = unknown, TGroup = undefined> = LayerMachineActor<TLayer, TGroup> | LayerGroupMachineActor<TLayer, TGroup>;

export interface ManagedLayer<TLayer, TGroup = undefined> {
  type: 'layer';
  layerActor: LayerMachineActor<TLayer, TGroup>;
}

export interface ManagedLayerGroup<TLayer, TGroup = undefined> {
  type: 'layerGroup';
  layerActor: LayerGroupMachineActor<TLayer, TGroup>;
}

/** An item in the manager's `layers`: a layer or group actor, with its `type`. */
export type ManagedItem<TLayer, TGroup = undefined> = ManagedLayer<TLayer, TGroup> | ManagedLayerGroup<TLayer, TGroup>;

export function isLayerMachine<TLayer, TGroup = undefined>(layer: LayerActor<TLayer, TGroup>): layer is LayerMachineActor<TLayer, TGroup> {
  return layer.getSnapshot().context.layerType === 'layer';
}

export function isLayerGroupMachine<TLayer, TGroup = undefined>(layer: LayerActor<TLayer, TGroup>): layer is LayerGroupMachineActor<TLayer, TGroup> {
  return layer.getSnapshot().context.layerType === 'layerGroup';
}

// ============================================================================
// ACTOR CONTEXT
// The state each actor holds, and the tags and start states of a layer or group.
// ============================================================================

export type LayerStateTag = 'enabled' | 'visible';

export type LayerStartState = 'enabled.hidden' | 'disabled';

export interface LayerContextBase<TLayer, TGroup = undefined> {
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

export interface LayerContext<TLayer, TGroup = undefined> extends LayerContextBase<TLayer, TGroup> {
  layerType: 'layer';
  layerData: TLayer;
  listMode: 'show' | 'hide';
}

export interface LayerGroupContext<TLayer, TGroup = undefined> extends LayerContextBase<TLayer, TGroup> {
  layerType: 'layerGroup';
  layerData: TGroup;
  children: ChildLayerActor[];
  /** The manager's order of this group's children, bottom first. Set only by the manager. */
  childLayerOrder: string[];
  listMode: 'show' | 'hide' | 'hide-children';
}

export interface LayerManagerContext<TLayer, TGroup = undefined> {
  layers: ManagedItem<TLayer, TGroup>[];
  childLayerOrder: string[];
  groupChildLayerOrder: Record<string, string[]>;
  allowNestedGroupLayers: boolean;
}

// ============================================================================
// INTERNAL EVENTS AND REFERENCES
// How the actors talk to each other. Not exported from the package.
// ============================================================================

/** Notifications a layer or group receives from its manager and its parent group. */
export type ChildEvent
  = | { type: 'LAYER.START_SHOWING' }
    | { type: 'PARENT.VISIBLE' }
    | { type: 'PARENT.HIDDEN' }
    | { type: 'PARENT.OPACITY_CHANGED'; opacity: number }
    | { type: 'PARENT.CHANGED'; parentRef: ParentLayerActor | null; parentOpacity: number; parentVisible: boolean };

/** Notifications a group receives about its children. */
export type ParentEvent
  = | { type: 'CHILD.VISIBLE'; layerId: string }
    | { type: 'LAYERS.CHILDREN_CHANGED'; children: ChildLayerActor[]; childLayerOrder: string[] };

/** Notifications that layer and group actors send to their manager. */
export type LayerManagerChildEvent<TLayer, TGroup = undefined>
  = | { type: 'CHILD.VISIBILITY_CHANGED'; layerId: string; visible: boolean }
    | { type: 'CHILD.ENABLED_CHANGED'; layerId: string; enabled: boolean }
    | { type: 'CHILD.OPACITY_CHANGED'; layerId: string; opacity: number; computedOpacity: number }
    | { type: 'CHILD.TIME_INFO_CHANGED'; layerId: string; timeInfo: LayerTimeInfo }
    | { type: 'CHILD.LAYER_DATA_CHANGED'; layerId: string; layerData: TLayer | TGroup }
    | { type: 'CHILD.REJECTED'; layerId: string; reason: string };

/** Every event a layer actor accepts. */
export type LayerEvent<TLayer> = LayerCommandEvent<TLayer> | ChildEvent;

/** Every event a group actor accepts. */
export type LayerGroupEvent<TGroup> = LayerCommandEvent<TGroup> | ChildEvent | ParentEvent;

export type LayerManagerRef<TLayer, TGroup = undefined> = ActorRef<Snapshot<unknown>, LayerManagerChildEvent<TLayer, TGroup>>;

export type ParentLayerSnapshot = Snapshot<unknown> & {
  context: Pick<LayerContextBase<unknown>, 'layerId' | 'computedOpacity'>;
  hasTag: (tag: LayerStateTag) => boolean;
};
export type ParentLayerActor = ActorRef<ParentLayerSnapshot, ParentEvent>;

export type ChildLayerSnapshot = Snapshot<unknown> & {
  context: Pick<LayerContextBase<unknown>, 'layerId'>;
};
export type ChildLayerActor = ActorRef<ChildLayerSnapshot, ChildEvent>;
