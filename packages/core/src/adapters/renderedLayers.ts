import type { LayerInfo, ManagedLayerInfo, RenderAdapterOptions, RenderLayer } from './types';

/** What {@link RenderedLayers} needs from an adapter: its map, its renderLayer, and how to put a result on the map. */
export interface RenderedLayersOptions<TLayer, TMap, TRendered> extends RenderAdapterOptions<TLayer, TMap, TRendered> {
  map: TMap;
  renderLayer: RenderLayer<TLayer, TMap, TRendered>;
  /** Puts what renderLayer returned for a layer on the map. */
  place: (info: LayerInfo<TLayer>, rendered: TRendered) => void;
  /** Takes what renderLayer returned for a layer off the map. */
  erase: (layerId: string, rendered: TRendered) => void;
  /**
   * Whether `next` stands in for `previous` on the map, so `previous` is not disposed of. Without it, only the same
   * object counts as the same.
   */
  isSame?: (previous: TRendered, next: TRendered) => boolean;
}

/**
 * Keeps what renderLayer returned for each layer, and calls the adapter's `place` and `erase` as layers are added,
 * changed and removed.
 */
export class RenderedLayers<TLayer, TMap, TRendered> {
  private readonly options: RenderedLayersOptions<TLayer, TMap, TRendered>;
  private readonly rendered = new Map<string, TRendered>();

  constructor(options: RenderedLayersOptions<TLayer, TMap, TRendered>) {
    this.options = options;
  }

  /** What renderLayer last returned for a layer, or `undefined` while the layer is off the map. */
  get(layerId: string): TRendered | undefined {
    return this.rendered.get(layerId);
  }

  /** Calls renderLayer for a newly added layer, and places what it returns. */
  add(info: ManagedLayerInfo<TLayer, unknown>): void {
    if (info.layerType !== 'layer') {
      return;
    }
    const rendered = this.options.renderLayer(info, this.options.map);
    if (rendered) {
      this.rendered.set(info.layerId, rendered);
      this.options.place(info, rendered);
    }
  }

  /** Calls renderLayer again for a layer whose data or time changed, and places what it returns in place of the old. */
  update(info: ManagedLayerInfo<TLayer, unknown>): void {
    if (info.layerType !== 'layer') {
      return;
    }
    const previous = this.rendered.get(info.layerId);
    const next = this.options.renderLayer(info, this.options.map, previous);
    if (next === previous) {
      return;
    }
    if (previous) {
      this.rendered.delete(info.layerId);
      this.options.erase(info.layerId, previous);
      if (!(next && this.options.isSame?.(previous, next))) {
        this.options.disposeLayer?.(previous, info.layerId);
      }
    }
    if (next) {
      this.rendered.set(info.layerId, next);
      this.options.place(info, next);
    }
  }

  /** Erases a removed layer, and disposes of what renderLayer returned for it. */
  remove(layerId: string): void {
    const rendered = this.rendered.get(layerId);
    if (rendered) {
      this.rendered.delete(layerId);
      this.options.erase(layerId, rendered);
      this.options.disposeLayer?.(rendered, layerId);
    }
  }

  /** Erases every layer and disposes of what renderLayer returned for each, as when the adapter is detached. */
  clear(): void {
    for (const layerId of [...this.rendered.keys()]) {
      this.remove(layerId);
    }
  }
}
