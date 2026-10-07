import type { RenderAdapterOptions, RenderLayer } from '@ulm/core';

import type L from 'leaflet';

// ============================================================================
// RENDER LAYER
// Returns the Leaflet layer that shows a layer. Return null to skip.
// When a layer's data or time changes, `current` is the Leaflet layer already
// drawn: return it to keep it, or return a new one to replace it.
// ============================================================================

export type LeafletRenderLayer<TLayer> = RenderLayer<TLayer, L.Map, L.Layer>;

// ============================================================================
// ADAPTER OPTIONS
// ============================================================================

export type LeafletAdapterOptions<TLayer> = RenderAdapterOptions<TLayer, L.Map, L.Layer>;
