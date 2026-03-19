import type {
  ChildLayerActor,
  LayerConfig,
  LayerGroupConfig,
  LayerGroupContext,
  LayerGroupMachineActor,
  LayerManagerContext,
  ManagedItem,
  ParentLayerActor,
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
 * Validates if a layer configuration can be added to the current context.
 * Checks for duplicate IDs and nested group permissions.
 *
 * @param layerConfig - The proposed new layer configuration.
 * @param context - The current Layer Manager context.
 * @returns True if valid, false otherwise (logs warnings on failure).
 */
export function isValidLayerConfig<TLayer, TGroup = TLayer>(
  layerConfig: LayerConfig<TLayer> | LayerGroupConfig<TLayer, TGroup>,
  { layers, allowNestedGroupLayers }: LayerManagerContext<TLayer, TGroup>,
): boolean {
  // Check: Nested Groups
  if (layerConfig.layerType === 'layerGroup' && layerConfig.parentId && !allowNestedGroupLayers) {
    console.warn('Nested group layers are not allowed.');
    return false;
  }

  // Check: Duplicate ID
  if (layers.some((layer) => layer.layerActor.id === layerConfig.layerId)) {
    console.warn(`Layer with ID ${layerConfig.layerId} already exists. Layer not added.`);
    return false;
  }

  return true;
}

/**
 * Ensures that if a parentId was requested, a valid parent actor exists.
 *
 * @param layerConfig - The layer config.
 * @param parentRef - The resolved parent actor reference.
 * @returns False if parentId exists but parentRef is missing.
 */
export function isValidParentRef<TLayer, TGroup = TLayer>(
  layerConfig: LayerConfig<TLayer> | LayerGroupConfig<TLayer, TGroup>,
  parentRef: LayerGroupMachineActor<TLayer, TGroup> | null,
): boolean {
  if (layerConfig.parentId && !parentRef) {
    console.warn('Unable to find valid parent layer. Layer not added.');
    return false;
  }
  return true;
}

/**
 * Checks if a layer can be safely removed.
 * Prevents removal of Groups that still contain children.
 *
 * @param layer - The layer to check.
 * @returns True if removable.
 */
export function canRemoveLayer<TLayer, TGroup = TLayer>(
  layer: ManagedItem<TLayer, TGroup>,
): boolean {
  if (!layer) {
    console.warn('Unable to find layer to remove.');
    return false;
  }

  const { layerType } = layer.layerActor.getSnapshot().context;

  if (layerType === 'layerGroup') {
    const { children } = layer.layerActor.getSnapshot().context as LayerGroupContext<TLayer, TGroup>;
    if (children.length > 0) {
      console.warn('Layer group has children. Not removed.');
      return false;
    }
  }

  return true;
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
 * Recursively flattens the layer tree into a single list of IDs.
 * Traverses into Group Layers to find children.
 *
 * @param layers - The full map of managed layers.
 * @param topLevelLayerOrder - The root order array.
 * @returns A flat array of all Layer IDs in depth-first order.
 */
export function getFlatLayerOrder<TLayer, TGroup = TLayer>(
  layers: ManagedItem<TLayer, TGroup>[],
  topLevelLayerOrder: string[],
): string[] {
  const flatOrder: string[] = [];

  const traverseLayers = (layerIds: string[]) => {
    layerIds.forEach((layerId) => {
      const layer = layers.find((l) => l.layerActor.id === layerId);
      if (!layer) {
        return;
      }

      flatOrder.push(layerId);

      const snapshot = layer.layerActor.getSnapshot();
      if (snapshot.context.layerType === 'layerGroup') {
        const groupContext = snapshot.context as LayerGroupContext<TLayer, TGroup>;
        traverseLayers(groupContext.childLayerOrder);
      }
    });
  };

  traverseLayers(topLevelLayerOrder);
  return flatOrder;
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
 * NOTE: If `parentRef` is provided, this function has a SIDE EFFECT
 * of sending an event to that parent actor.
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
    ? addLayerToParent(context.layers, newManagedLayer, parentRef, index, position)
    : addLayerToTopLevel(context.layers, newManagedLayer, context.childLayerOrder, index, position);
}

/**
 * Handles cleanup when a layer is removed.
 * Sends a removal event to the parent actor if one exists.
 */
export function cleanupLayerReferences<TLayer, TGroup = TLayer>(
  layer: ManagedItem<TLayer, TGroup>,
): void {
  const { parentRef } = layer.layerActor.getSnapshot().context;
  if (parentRef) {
    parentRef.send({ type: 'LAYERS.REMOVE_CHILD', id: layer.layerActor.id });
  }
}

/**
 * Calculates the new state after removing a layer.
 * Removes the layer from the main list and the top-level order array.
 */
export function getUpdatedLayerStructureAfterRemoval<TLayer, TGroup = TLayer>(
  context: LayerManagerContext<TLayer, TGroup>,
  layerId: string,
): Partial<LayerManagerContext<TLayer, TGroup>> {
  return {
    layers: context.layers.filter((layer) => layer.layerActor.id !== layerId),
    childLayerOrder: context.childLayerOrder.filter((id) => id !== layerId),
  };
}

// ============================================================================
// OPACITY CALCULATION
// Functions for computing opacity values.
// ============================================================================

/**
 * Calculates the computed opacity for a layer by multiplying its own opacity
 * with the parent's computed opacity (if a parent exists).
 *
 * @param parentRef - The parent layer actor reference, or null if no parent.
 * @param ownOpacity - The layer's own opacity value (0-1).
 * @returns The computed opacity value (0-1).
 */
export function calculateComputedOpacity(
  parentRef: ParentLayerActor | null,
  ownOpacity: number,
): number {
  if (!parentRef) {
    return ownOpacity;
  }
  const parentSnapshot = parentRef.getSnapshot();
  const parentComputedOpacity = parentSnapshot.context.computedOpacity;
  return parentComputedOpacity * ownOpacity;
}

// ============================================================================
// INTERNAL HELPERS
// Private implementation details for Manager Actions.
// ============================================================================

function addLayerToParent<TLayer, TGroup = TLayer>(
  layers: ManagedItem<TLayer, TGroup>[],
  newLayer: ManagedItem<TLayer, TGroup>,
  parentRef: ParentLayerActor,
  index?: number,
  position?: 'top' | 'bottom',
): Partial<LayerManagerContext<TLayer, TGroup>> {
  // SIDE EFFECT: Notify parent to add child
  parentRef.send({ type: 'LAYERS.ADD_CHILD', child: newLayer.layerActor as ChildLayerActor, index, position });

  return {
    layers: [...layers, newLayer],
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
