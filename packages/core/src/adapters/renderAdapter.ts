import type { LayerManagerAdapter, ManagedLayerInfo, RenderAdapterOptions, RenderLayer } from './types';

/** A layer that renderLayer returned something for, and how the map should show it. */
export interface RenderedLayer<TRendered> {
  layerId: string;
  /** What renderLayer returned for the layer. */
  rendered: TRendered;
  visible: boolean;
  computedOpacity: number;
}

interface LayerState<TRendered> {
  visible: boolean;
  computedOpacity: number;
  rendered?: TRendered;
}

/**
 * A base class for adapters that show each layer with a renderLayer function. It handles every hook: it calls
 * renderLayer and disposeLayer, skips groups, and keeps each layer's visibility, opacity and place in the order.
 * A subclass only changes the map, in the protected methods below.
 */
export abstract class RenderAdapter<TLayer, TGroup, TMap, TRendered> implements LayerManagerAdapter<TLayer, TGroup> {
  protected readonly map: TMap;
  private readonly renderLayer: RenderLayer<TLayer, TMap, TRendered>;
  private readonly disposeLayer: RenderAdapterOptions<TLayer, TMap, TRendered>['disposeLayer'];
  private readonly layers = new Map<string, LayerState<TRendered>>();
  private layerOrder: string[] = [];

  constructor(map: TMap, options: RenderAdapterOptions<TLayer, TMap, TRendered> & { renderLayer: RenderLayer<TLayer, TMap, TRendered> }) {
    this.map = map;
    this.renderLayer = options.renderLayer;
    this.disposeLayer = options.disposeLayer;
  }

  // --------------------------------------------------------------------------
  // What a subclass does to the map
  // --------------------------------------------------------------------------

  /** Puts a layer on the map, with `previous` set to what it replaces, if anything. */
  protected abstract placeLayer(layer: RenderedLayer<TRendered>, previous?: TRendered): void;

  /** Takes a layer off the map, with `next` set to what replaces it, if anything. */
  protected abstract eraseLayer(layerId: string, rendered: TRendered, next?: TRendered): void;

  /** Shows or hides a layer on the map, as `layer.visible` says. */
  protected abstract setLayerVisible(layer: RenderedLayer<TRendered>): void;

  /** Fades a layer on the map to `layer.computedOpacity`. */
  protected abstract setLayerOpacity(layer: RenderedLayer<TRendered>): void;

  /** Stacks the layers on the map in this order, from the bottom up. */
  protected abstract restackLayers(bottomToTop: RenderedLayer<TRendered>[]): void;

  /**
   * Whether `next` stands in for `previous` on the map: `previous` is not disposed of, and the layer keeps its place in
   * the stack. Only the same object counts unless a subclass says otherwise.
   */
  protected isSame(_previous: TRendered, _next: TRendered): boolean {
    return false;
  }

  /** Every layer renderLayer returned something for. */
  protected renderedLayers(): RenderedLayer<TRendered>[] {
    return [...this.layers.keys()].flatMap((layerId) => this.renderedLayer(layerId) ?? []);
  }

  /** Places every layer again and stacks them, for a map that lost them, such as MapLibre after a style change. */
  protected placeAll(): void {
    for (const layer of this.renderedLayers()) {
      this.placeLayer(layer);
    }
    this.restack();
  }

  // --------------------------------------------------------------------------
  // Hooks — called by LayerManager
  // --------------------------------------------------------------------------

  unregister(): void {
    for (const layerId of [...this.layers.keys()]) {
      this.removeRendered(layerId);
    }
    this.layers.clear();
  }

  onLayerAdded(info: ManagedLayerInfo<TLayer, TGroup>): void {
    if (info.layerType !== 'layer') {
      return;
    }
    const state: LayerState<TRendered> = { visible: info.visible, computedOpacity: info.computedOpacity };
    this.layers.set(info.layerId, state);
    const rendered = this.renderLayer(info, this.map);
    if (rendered) {
      state.rendered = rendered;
      this.placeLayer({ layerId: info.layerId, rendered, visible: state.visible, computedOpacity: state.computedOpacity });
    }
  }

  onLayerRemoved(layerId: string): void {
    this.removeRendered(layerId);
    this.layers.delete(layerId);
  }

  onVisibilityChanged(info: ManagedLayerInfo<TLayer, TGroup>, visible: boolean): void {
    const state = this.layers.get(info.layerId);
    if (!state) {
      return;
    }
    state.visible = visible;
    const layer = this.renderedLayer(info.layerId);
    if (layer) {
      this.setLayerVisible(layer);
    }
  }

  onOpacityChanged(info: ManagedLayerInfo<TLayer, TGroup>, computedOpacity: number): void {
    const state = this.layers.get(info.layerId);
    if (!state) {
      return;
    }
    state.computedOpacity = computedOpacity;
    const layer = this.renderedLayer(info.layerId);
    if (layer) {
      this.setLayerOpacity(layer);
    }
  }

  onLayerDataChanged(info: ManagedLayerInfo<TLayer, TGroup>): void {
    if (info.layerType !== 'layer') {
      return;
    }
    const state = this.layers.get(info.layerId);
    if (!state) {
      return;
    }
    const previous = state.rendered;
    const next = this.renderLayer(info, this.map, previous);
    if (next === previous) {
      return;
    }
    state.rendered = undefined;
    if (previous) {
      this.eraseLayer(info.layerId, previous, next ?? undefined);
      if (!(next && this.isSame(previous, next))) {
        this.disposeLayer?.(previous, info.layerId);
      }
    }
    if (next) {
      state.rendered = next;
      this.placeLayer({ layerId: info.layerId, rendered: next, visible: state.visible, computedOpacity: state.computedOpacity }, previous);
      if (!(previous && this.isSame(previous, next))) {
        this.restack();
      }
    }
  }

  onOrderChanged(layerOrder: string[]): void {
    this.layerOrder = layerOrder;
    this.restack();
  }

  // renderLayer can read the time, so a new time renders the layer again as new data does.
  onTimeInfoChanged(info: ManagedLayerInfo<TLayer, TGroup>): void {
    this.onLayerDataChanged(info);
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private restack(): void {
    this.restackLayers(this.layerOrder.flatMap((layerId) => this.renderedLayer(layerId) ?? []));
  }

  private renderedLayer(layerId: string): RenderedLayer<TRendered> | undefined {
    const state = this.layers.get(layerId);
    if (!state?.rendered) {
      return undefined;
    }
    return { layerId, rendered: state.rendered, visible: state.visible, computedOpacity: state.computedOpacity };
  }

  // Takes a layer's result off the map and disposes of it. The layer stays known, so it can be shown again.
  private removeRendered(layerId: string): void {
    const state = this.layers.get(layerId);
    const rendered = state?.rendered;
    if (state && rendered) {
      state.rendered = undefined;
      this.eraseLayer(layerId, rendered);
      this.disposeLayer?.(rendered, layerId);
    }
  }
}
