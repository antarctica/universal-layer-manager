import type { DrawingAdapterOptions, LayerFactory } from '@ulm/core';

import type L from 'leaflet';

// ============================================================================
// LAYER FACTORY
// Creates a Leaflet layer from adapter layer info. Return null to skip.
// When a layer's data or time changes, `current` is the Leaflet layer already
// drawn: return it to keep it, or return a new one to replace it.
// ============================================================================

export type LeafletLayerFactory<TLayer> = LayerFactory<TLayer, L.Map, L.Layer>;

// ============================================================================
// ADAPTER OPTIONS
// ============================================================================

export type LeafletAdapterOptions<TLayer> = DrawingAdapterOptions<TLayer, L.Map, L.Layer>;
