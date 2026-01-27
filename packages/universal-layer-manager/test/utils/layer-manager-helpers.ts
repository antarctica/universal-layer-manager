import type { LayerManagerActor } from '../../src/layerManagerMachines/layerManagerMachine';
import type { LayerConfig, LayerGroupConfig, LayerGroupMachineActor, LayerMachineActor } from '../../src/types';
import { createActor } from 'xstate';
import { createLayerManagerMachine } from '../../src/layerManagerMachines/layerManagerMachine';
import { findManagedLayerById } from '../../src/utils';

export interface TestLayerData {
  test: string;
}

export interface CreateTestLayerOptions {
  visible?: boolean;
}

/**
 * Configuration for creating a new layer manager instance.
 */
export interface CreateLayerManagerOptions {
  /** Whether nested group layers are allowed (default: true) */
  allowNestedGroupLayers?: boolean;
}

/**
 * Creates and starts a new layer manager actor for testing.
 *
 * This creates a real layer manager machine (not a mock) that can be used
 * to test layer machines in their proper context.
 *
 * @param options - Configuration for the layer manager
 * @returns A started layer manager actor
 */
export function createTestLayerManager<TLayer = TestLayerData, TGroup = TLayer>(
  options: CreateLayerManagerOptions = {},
): LayerManagerActor<TLayer, TGroup> {
  const { allowNestedGroupLayers = true } = options;

  const layerManagerMachine = createLayerManagerMachine<TLayer, TGroup>();
  const layerManager = createActor(layerManagerMachine, {
    input: {
      allowNestedGroupLayers,
    },
  });

  layerManager.start();

  return layerManager as LayerManagerActor<TLayer, TGroup>;
}

/**
 * Creates a default layer configuration for testing.
 * Provides sensible defaults that can be overridden.
 */
export function createTestLayerConfig<TLayer = TestLayerData>(
  overrides: Partial<LayerConfig<TLayer>> = {},
): LayerConfig<TLayer> {
  return {
    layerId: 'layer-1',
    layerName: 'Test layer',
    layerData: { test: 'test' } as TLayer,
    layerType: 'layer',
    parentId: null,
    ...overrides,
  };
}

/**
 * Creates a default layer group configuration for testing.
 * Provides sensible defaults that can be overridden.
 */
export function createTestLayerGroupConfig<TGroup = TestLayerData>(
  overrides: Partial<LayerGroupConfig<TestLayerData, TGroup>> = {},
): LayerGroupConfig<TestLayerData, TGroup> {
  return {
    layerId: 'group-1',
    layerName: 'Test group',
    layerData: { test: 'group-test' } as TGroup,
    layerType: 'layerGroup',
    parentId: null,
    ...overrides,
  };
}

/**
 * Creates a layer manager with a single layer configured for testing.
 *
 * This is a convenience function that combines creating a manager and adding
 * a layer with sensible defaults. Use this when you need a simple test setup.
 *
 * @param layerOptions - Configuration for the layer (optional)
 * @param layerOptions.visible - Whether the layer should be visible/enabled on creation (default: false)
 * @param managerOptions - Configuration for the manager (optional)
 * @returns The layer actor and the manager
 */
export function createLayerWithManager<TLayer = TestLayerData, TGroup = TLayer>(
  layerOptions: CreateTestLayerOptions & Partial<LayerConfig<TLayer>> = {},
  managerOptions: CreateLayerManagerOptions = {},
): {
  layerActor: LayerMachineActor<TLayer, TGroup>;
  layerManager: LayerManagerActor<TLayer, TGroup>;
} {
  const layerManager = createTestLayerManager<TLayer, TGroup>(managerOptions);
  const { visible, ...configOverrides } = layerOptions;
  const config = createTestLayerConfig<TLayer>(configOverrides);

  return addLayerToManager(layerManager, config, { visible });
}

/**
 * Adds a layer to a layer manager and returns the created layer actor.
 *
 * This function:
 * 1. Creates a layer configuration
 * 2. Sends LAYER.ADD event to the manager
 * 3. Retrieves the spawned layer actor from the manager's context
 * 4. Returns both the layer actor and the manager for further testing
 *
 * @param layerManager - The layer manager to add the layer to
 * @param config - Layer configuration
 * @param options - Optional configuration values
 * @param options.visible - Whether the layer should be visible/enabled on creation (default: false)
 * @returns The layer actor and the manager
 * @throws Error if the layer was not successfully created
 */
export function addLayerToManager<TLayer = TestLayerData, TGroup = TLayer>(
  layerManager: LayerManagerActor<TLayer, TGroup>,
  config: LayerConfig<TLayer>,
  options?: {
    visible?: boolean;
  },
): {
  layerActor: LayerMachineActor<TLayer, TGroup>;
  layerManager: LayerManagerActor<TLayer, TGroup>;
} {
  const { layerId } = config;
  layerManager.send({ type: 'LAYER.ADD', params: { layerConfig: config, visible: options?.visible ?? false } });

  const managerSnapshot = layerManager.getSnapshot();
  const managedLayer = findManagedLayerById(managerSnapshot.context.layers, layerId);

  if (!managedLayer || managedLayer.type !== 'layer') {
    throw new Error(
      `Failed to create layer '${layerId}' through manager. Expected layer type but got: ${managedLayer?.type ?? 'null'}`,
    );
  }

  return {
    layerActor: managedLayer.layerActor,
    layerManager,
  };
}

/**
 * Adds a layer group to a layer manager and returns the created group actor.
 *
 * This function:
 * 1. Creates a layer group configuration
 * 2. Sends LAYER.ADD event to the manager
 * 3. Retrieves the spawned group actor from the manager's context
 * 4. Returns both the group actor and the manager for further testing
 *
 * @param layerManager - The layer manager to add the group to
 * @param config - Layer group configuration
 * @param options - Optional configuration values
 * @param options.visible - Whether the group should be visible/enabled on creation (default: false)
 * @returns The group actor and the manager
 * @throws Error if the group was not successfully created
 */
export function addLayerGroupToManager<TLayer = TestLayerData, TGroup = TLayer>(
  layerManager: LayerManagerActor<TLayer, TGroup>,
  config: LayerGroupConfig<TLayer, TGroup>,
  options?: {
    visible?: boolean;
  },
): {
  groupActor: LayerGroupMachineActor<TLayer, TGroup>;
  layerManager: LayerManagerActor<TLayer, TGroup>;
} {
  const { layerId } = config;
  layerManager.send({ type: 'LAYER.ADD', params: { layerConfig: config, visible: options?.visible ?? false } });

  const managerSnapshot = layerManager.getSnapshot();
  const managedItem = findManagedLayerById(managerSnapshot.context.layers, layerId);

  if (!managedItem || managedItem.type !== 'layerGroup') {
    throw new Error(
      `Failed to create layer group '${layerId}' through manager. Expected layerGroup type but got: ${managedItem?.type ?? 'null'}`,
    );
  }

  return {
    groupActor: managedItem.layerActor,
    layerManager,
  };
}

/**
 * Adds a child layer to a parent layer group.
 *
 * @param layerManager - The layer manager
 * @param parentGroupId - The ID of the parent group
 * @param childConfig - Configuration for the child layer
 * @param options - Optional configuration values
 * @param options.visible - Whether the child should be visible/enabled on creation (default: false)
 * @param options.index - Optional index for positioning
 * @param options.position - Optional position ('top' | 'bottom')
 * @returns The child layer actor
 * @throws Error if the parent group or child layer was not successfully found/created
 */
export function addChildLayerToGroup<TLayer = TestLayerData, TGroup = TLayer>(
  layerManager: LayerManagerActor<TLayer, TGroup>,
  parentGroupId: string,
  childConfig: LayerConfig<TLayer>,
  options?: {
    visible?: boolean;
    index?: number;
    position?: 'top' | 'bottom';
    enabled?: boolean;
  },
): {
  childActor: LayerMachineActor<TLayer, TGroup>;
  groupActor: LayerGroupMachineActor<TLayer, TGroup>;
} {
  // Set parent ID
  const configWithParent = { ...childConfig, parentId: parentGroupId };

  // Add the child layer
  layerManager.send({
    type: 'LAYER.ADD',
    params: {
      layerConfig: configWithParent,
      visible: options?.visible ?? false,
      index: options?.index,
      position: options?.position,
      enabled: options?.enabled ?? false,
    },
  });

  // Get the parent group
  const managerSnapshot = layerManager.getSnapshot();
  const parentItem = findManagedLayerById(managerSnapshot.context.layers, parentGroupId);

  if (!parentItem || parentItem.type !== 'layerGroup') {
    throw new Error(`Parent group '${parentGroupId}' not found or is not a layer group`);
  }

  // Get the child layer
  const childItem = findManagedLayerById(managerSnapshot.context.layers, childConfig.layerId);
  if (!childItem || childItem.type !== 'layer') {
    throw new Error(`Failed to create child layer '${childConfig.layerId}'`);
  }

  return {
    childActor: childItem.layerActor,
    groupActor: parentItem.layerActor,
  };
}
