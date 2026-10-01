import type {
  ChildLayerActor,
  LayerActor,
  LayerConfig,
  LayerGroupConfig,
  LayerGroupMachineActor,
  LayerManagerContext,
  ManagedItem,
  MoveLayerParams,
  ParentEvent,
} from './types';
import { isLayerGroupMachine } from './types';

// ============================================================================
// SEARCH & RETRIEVAL (QUERIES)
// Functions for finding layers and extracting data from the list.
// ============================================================================

/**
 * Finds a managed layer item by its ID.
 *
 * @param layers - The array of managed items to search.
 * @param layerId - The unique ID of the layer to find.
 * @returns The ManagedItem if found, otherwise undefined.
 */
export function findManagedLayerById<TLayer, TGroup = TLayer>(
  layers: ManagedItem<TLayer, TGroup>[],
  layerId: string,
): ManagedItem<TLayer, TGroup> | undefined {
  return layers.find((layer) => layer.layerActor.id === layerId);
}

/**
 * Extracts the layer data (context) from a specific layer ID.
 *
 * @param layers - The array of managed items.
 * @param layerId - The ID of the target layer.
 * @returns The layer data (TLayer or TGroup) if found, otherwise undefined.
 */
export function getLayerDataFromLayerId<TLayer, TGroup = TLayer>(
  layers: ManagedItem<TLayer, TGroup>[],
  layerId: string,
): TLayer | TGroup | undefined {
  const layer = findManagedLayerById(layers, layerId);
  if (!layer) {
    return undefined;
  }
  return layer.layerActor.getSnapshot().context.layerData;
}

/**
 * Resolves the parent actor for a given configuration.
 *
 * @param layers - The list of existing layers.
 * @param layerConfig - The configuration containing the `parentId`.
 * @returns The parent LayerGroupMachineActor if valid, otherwise null.
 */
export function findParentActor<TLayer, TGroup = TLayer>(
  layers: ManagedItem<TLayer, TGroup>[],
  layerConfig: LayerConfig<TLayer> | LayerGroupConfig<TLayer, TGroup>,
): LayerGroupMachineActor<TLayer, TGroup> | null {
  return layerConfig.parentId
    ? findParentLayerGroupActor(layers, layerConfig.parentId)
    : null;
}

/**
 * Finds the group that holds a layer, from the manager's own structure.
 *
 * @param context - The manager's child order for each group.
 * @param layerId - The ID of the child layer.
 * @returns The parent group ID, or undefined for a top-level or unknown layer.
 */
export function findParentGroupId<TLayer, TGroup = TLayer>(
  context: Pick<LayerManagerContext<TLayer, TGroup>, 'groupChildLayerOrder'>,
  layerId: string,
): string | undefined {
  return Object.keys(context.groupChildLayerOrder).find((groupId) => context.groupChildLayerOrder[groupId]?.includes(layerId));
}

/**
 * Finds where a layer sits in the manager's structure.
 *
 * @param context - The manager's top-level order and each group's child order.
 * @param layerId - The ID of the layer.
 * @returns The parent group ID (null at the top level), the layer's index from the bottom
 * and the number of layers in that parent, or undefined for an unknown layer.
 */
export function findLayerPlacement<TLayer, TGroup = TLayer>(
  context: Pick<LayerManagerContext<TLayer, TGroup>, 'childLayerOrder' | 'groupChildLayerOrder'>,
  layerId: string,
): { parentId: string | null; index: number; siblingCount: number } | undefined {
  const parentId = findParentGroupId(context, layerId) ?? null;
  const siblings = parentId ? context.groupChildLayerOrder[parentId] ?? [] : context.childLayerOrder;
  const index = siblings.indexOf(layerId);
  return index === -1 ? undefined : { parentId, index, siblingCount: siblings.length };
}

/**
 * Specific helper to find an actor strictly if it is a Layer Group.
 *
 * @param layers - The list of layers.
 * @param parentId - The ID of the potential parent.
 * @returns The LayerGroup actor if found and is a group, otherwise null.
 */
export function findParentLayerGroupActor<TLayer, TGroup = TLayer>(
  layers: ManagedItem<TLayer, TGroup>[],
  parentId: string,
): LayerGroupMachineActor<TLayer, TGroup> | null {
  const layer = findManagedLayerById(layers, parentId);

  if (!layer || !isLayerGroupMachine(layer.layerActor)) {
    return null;
  }

  return layer.layerActor;
}

// ============================================================================
// VALIDATION (GUARDS)
// Pure functions to check if actions are permitted.
// ============================================================================

/**
 * Explains why a layer configuration cannot be added to the current context.
 *
 * @param layerConfig - The proposed new layer configuration.
 * @param context - The current Layer Manager context.
 * @returns The rejection reason, or undefined if the layer can be added.
 */
export function getAddLayerRejection<TLayer, TGroup = TLayer>(
  layerConfig: LayerConfig<TLayer> | LayerGroupConfig<TLayer, TGroup>,
  context: LayerManagerContext<TLayer, TGroup>,
): string | undefined {
  if (layerConfig.layerType === 'layerGroup' && layerConfig.parentId && !context.allowNestedGroupLayers) {
    return 'Nested group layers are not allowed.';
  }

  if (context.layers.some((layer) => layer.layerActor.id === layerConfig.layerId)) {
    return `Layer with ID ${layerConfig.layerId} already exists. Layer not added.`;
  }

  if (layerConfig.parentId && !findParentLayerGroupActor(context.layers, layerConfig.parentId)) {
    return `Unable to find parent group ${layerConfig.parentId}. Layer ${layerConfig.layerId} not added.`;
  }

  return undefined;
}

/**
 * Explains why a layer cannot be removed from the current context.
 *
 * @param layerId - The ID of the layer to remove.
 * @param context - The current Layer Manager context.
 * @returns The rejection reason, or undefined if the layer can be removed.
 */
export function getRemoveLayerRejection<TLayer, TGroup = TLayer>(
  layerId: string,
  context: LayerManagerContext<TLayer, TGroup>,
): string | undefined {
  const layer = findManagedLayerById(context.layers, layerId);
  if (!layer) {
    return `Unable to find layer ${layerId}. Layer not removed.`;
  }

  if (isLayerGroupMachine(layer.layerActor) && layer.layerActor.getSnapshot().context.children.length > 0) {
    return `Layer group ${layerId} has children. Layer not removed.`;
  }

  return undefined;
}

/**
 * Explains why a layer cannot be moved to the given target.
 *
 * @param context - The current Layer Manager context.
 * @param move - The layer to move and its target parent, index and position.
 * @returns The rejection reason, or undefined if the layer can be moved.
 */
export function getMoveLayerRejection<TLayer, TGroup = TLayer>(
  context: LayerManagerContext<TLayer, TGroup>,
  move: MoveLayerParams,
): string | undefined {
  if (!findManagedLayerById(context.layers, move.layerId)) {
    return `Unable to find layer ${move.layerId}. Layer not moved.`;
  }

  if (move.parentId && !findParentLayerGroupActor(context.layers, move.parentId)) {
    return `Unable to find parent group ${move.parentId}. Layer ${move.layerId} not moved.`;
  }

  if (move.parentId && isSameOrDescendant(context, move.parentId, move.layerId)) {
    return `Layer group ${move.layerId} cannot be moved into itself or one of its descendants. Layer not moved.`;
  }

  return undefined;
}

/**
 * Checks if a provided index is within the bounds of the array.
 */
export function isValidLayerIndex(index: number, length: number): boolean {
  return index >= 0 && index <= length;
}

// ============================================================================
// SECTION STRUCTURE & TRAVERSAL
// Functions involved in ordering, flattening, and sorting lists.
// ============================================================================

/**
 * Updates an array of layer IDs to include a new ID at a specific location.
 *
 * @param currentOrder - The existing array of IDs.
 * @param newLayerId - The ID to insert.
 * @param index - (Optional) Specific index to insert at.
 * @param position - (Optional) 'top' (end of array) or 'bottom' (start of array).
 * @returns A new array with the order updated.
 */
export function updateLayerOrder(
  currentOrder: string[],
  newLayerId: string,
  index?: number,
  position?: 'top' | 'bottom',
): string[] {
  const newOrder = [...currentOrder];

  if (index !== undefined && isValidLayerIndex(index, currentOrder.length)) {
    // Clamp index to length if it exceeds it
    const safeIndex = index > currentOrder.length ? currentOrder.length : index;
    newOrder.splice(safeIndex, 0, newLayerId);
  } else if (position === 'top') {
    // 'Top' implies highest Z-index, usually end of array in rendering
    newOrder.push(newLayerId);
  } else {
    // 'Bottom' implies lowest Z-index, usually start of array
    newOrder.unshift(newLayerId);
  }

  return newOrder;
}

/**
 * Flattens the manager's layer tree into a single list of IDs.
 *
 * @param context - The manager's top-level order and each group's child order.
 * @returns A flat array of all Layer IDs in depth-first order.
 */
export function getFlatLayerOrder<TLayer, TGroup = TLayer>(
  context: Pick<LayerManagerContext<TLayer, TGroup>, 'childLayerOrder' | 'groupChildLayerOrder'>,
): string[] {
  const traverseLayers = (layerIds: string[]): string[] =>
    layerIds.flatMap((layerId) => [layerId, ...traverseLayers(context.groupChildLayerOrder[layerId] ?? [])]);

  return traverseLayers(context.childLayerOrder);
}

/**
 * Maps the top-level order array of strings to actual ManagedItem objects.
 */
export function getTopLevelLayersInOrder<TLayer, TGroup = TLayer>(
  layerOrder: string[],
  layers: ManagedItem<TLayer, TGroup>[],
): ManagedItem<TLayer, TGroup>[] {
  return layerOrder
    .map((layerId) => layers.find((l) => l.layerActor.id === layerId))
    .filter((layer): layer is ManagedItem<TLayer, TGroup> => layer !== undefined);
}

/**
 * Builds the event that tells a group which children it has, in the manager's order.
 *
 * @param context - The current Layer Manager context.
 * @param groupId - The ID of the group whose children changed.
 * @returns A LAYERS.CHILDREN_CHANGED event for the group.
 */
export function getGroupChildrenChangedEvent<TLayer, TGroup = TLayer>(
  context: LayerManagerContext<TLayer, TGroup>,
  groupId: string,
): Extract<ParentEvent, { type: 'LAYERS.CHILDREN_CHANGED' }> {
  const childLayerOrder = context.groupChildLayerOrder[groupId] ?? [];
  const children = childLayerOrder
    .map((layerId) => findManagedLayerById(context.layers, layerId)?.layerActor)
    .filter((layerActor): layerActor is LayerActor<TLayer, TGroup> => layerActor !== undefined);
  return { type: 'LAYERS.CHILDREN_CHANGED', children, childLayerOrder };
}

/**
 * Maps a Group's child order array to actual ChildLayerActor objects.
 */
export function getLayerGroupChildrenInOrder(
  childLayerOrder: string[],
  layers: ChildLayerActor[],
): ChildLayerActor[] {
  return childLayerOrder
    .map((layerId) => layers.find((l) => l.id === layerId))
    .filter((layer): layer is ChildLayerActor => layer !== undefined);
}

// ============================================================================
// SECTION MANAGER ACTIONS
// Complex logic involving context updates and Actor communication.
// ============================================================================

/**
 * Calculates the new state for the Layer Manager after adding a layer.
 *
 * @param context - Current manager context.
 * @param newManagedLayer - The new layer wrapper to add.
 * @param parentRef - The parent actor (if adding to a group).
 * @param index - Optional index.
 * @param position - Optional position ('top' | 'bottom').
 * @returns A partial context update (layers list and potentially order).
 */
export function getUpdatedLayerStructure<TLayer, TGroup = TLayer>(
  context: LayerManagerContext<TLayer, TGroup>,
  newManagedLayer: ManagedItem<TLayer, TGroup>,
  parentRef: LayerGroupMachineActor<TLayer, TGroup> | null,
  index?: number,
  position?: 'top' | 'bottom',
): Partial<LayerManagerContext<TLayer, TGroup>> {
  return parentRef
    ? addLayerToParent(context, newManagedLayer, parentRef.id, index, position)
    : addLayerToTopLevel(context.layers, newManagedLayer, context.childLayerOrder, index, position);
}

/**
 * Calculates the new state after removing a layer.
 * Removes the layer from the main list, the top-level order and every group's child order.
 */
export function getUpdatedLayerStructureAfterRemoval<TLayer, TGroup = TLayer>(
  context: LayerManagerContext<TLayer, TGroup>,
  layerId: string,
): Partial<LayerManagerContext<TLayer, TGroup>> {
  const groupChildLayerOrder = Object.fromEntries(
    Object.entries(context.groupChildLayerOrder)
      .filter(([groupId]) => groupId !== layerId)
      .map(([groupId, order]) => [groupId, order.filter((id) => id !== layerId)]),
  );
  return {
    layers: context.layers.filter((layer) => layer.layerActor.id !== layerId),
    childLayerOrder: context.childLayerOrder.filter((id) => id !== layerId),
    groupChildLayerOrder,
  };
}

/**
 * Calculates the new state after moving a layer to a new place in the tree.
 *
 * @param context - Current manager context.
 * @param move - The layer to move and its target parent, index and position.
 * @returns A partial context update with the new order.
 */
export function getUpdatedLayerStructureAfterMove<TLayer, TGroup = TLayer>(
  context: LayerManagerContext<TLayer, TGroup>,
  move: MoveLayerParams,
): Partial<LayerManagerContext<TLayer, TGroup>> {
  const childLayerOrder = context.childLayerOrder.filter((id) => id !== move.layerId);
  const groupChildLayerOrder = Object.fromEntries(
    Object.entries(context.groupChildLayerOrder).map(([groupId, order]) => [groupId, order.filter((id) => id !== move.layerId)]),
  );

  if (move.parentId) {
    groupChildLayerOrder[move.parentId] = updateLayerOrder(groupChildLayerOrder[move.parentId] ?? [], move.layerId, move.index, move.position);
    return { childLayerOrder, groupChildLayerOrder };
  }

  return {
    childLayerOrder: updateLayerOrder(childLayerOrder, move.layerId, move.index, move.position),
    groupChildLayerOrder,
  };
}

// ============================================================================
// INTERNAL HELPERS
// Private implementation details for Manager Actions.
// ============================================================================

function isSameOrDescendant<TLayer, TGroup = TLayer>(
  context: Pick<LayerManagerContext<TLayer, TGroup>, 'groupChildLayerOrder'>,
  layerId: string,
  ancestorId: string,
): boolean {
  if (layerId === ancestorId) {
    return true;
  }
  const parentId = findParentGroupId(context, layerId);
  return parentId !== undefined && isSameOrDescendant(context, parentId, ancestorId);
}

function addLayerToParent<TLayer, TGroup = TLayer>(
  context: LayerManagerContext<TLayer, TGroup>,
  newLayer: ManagedItem<TLayer, TGroup>,
  parentId: string,
  index?: number,
  position?: 'top' | 'bottom',
): Partial<LayerManagerContext<TLayer, TGroup>> {
  const siblingOrder = context.groupChildLayerOrder[parentId] ?? [];
  return {
    layers: [...context.layers, newLayer],
    groupChildLayerOrder: {
      ...context.groupChildLayerOrder,
      [parentId]: updateLayerOrder(siblingOrder, newLayer.layerActor.id, index, position),
    },
  };
}

function addLayerToTopLevel<TLayer, TGroup = TLayer>(
  layers: ManagedItem<TLayer, TGroup>[],
  newLayer: ManagedItem<TLayer, TGroup>,
  childLayerOrder: string[],
  index?: number,
  position?: 'top' | 'bottom',
): Partial<LayerManagerContext<TLayer, TGroup>> {
  const newLayerOrder = updateLayerOrder(childLayerOrder, newLayer.layerActor.id, index, position);
  return {
    layers: [...layers, newLayer],
    childLayerOrder: newLayerOrder,
  };
}
