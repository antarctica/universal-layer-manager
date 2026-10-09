import type { LayerTree, ManagedLayerInfo } from '@ulm/core';
import { LayerManager } from '@ulm/core';
import './style.css';

const list = document.getElementById('layer-list')!;
const log = document.getElementById('event-log')!;

// ---- Layer Manager ----
// The change hooks and onError write each event to the log. Whenever anything changes, draw the whole list again from
// the manager's layer tree.

const manager = new LayerManager<undefined>({
  allowNestedGroupLayers: true,
  onLayerAdded: (info) => logEvent('onLayerAdded', info.layerName),
  onLayerRemoved: (layerId) => logEvent('onLayerRemoved', layerId),
  onEnabledChanged: (info, enabled) => logEvent('onEnabledChanged', `${info.layerName} → ${enabled ? 'on' : 'off'}`),
  onVisibilityChanged: (info, visible) => logEvent('onVisibilityChanged', `${info.layerName} → ${visible ? 'visible' : 'hidden'}`),
  onOpacityChanged: (info, computedOpacity) => logEvent('onOpacityChanged', `${info.layerName} → ${Math.round(computedOpacity * 100)}%`),
  onLayerMoved: (info) => logEvent('onLayerMoved', `${info.layerName} → ${info.parentId ?? 'top level'}`),
  onOrderChanged: (layerOrder) => logEvent('onOrderChanged', `bottom → top: ${layerOrder.join(', ') || 'empty'}`),
  onError: (error) => logEvent('onError', error.message),
});
manager.subscribe(render);

function addLayer(parentId: string | null) {
  const id = Math.random().toString(36).substring(7);
  manager.addLayer({
    layerConfig: { layerId: id, layerName: `Layer ${id}`, parentId, layerType: 'layer' },
    visible: true,
  });
}

function addGroup(parentId: string | null) {
  const id = Math.random().toString(36).substring(7);
  manager.addGroup({
    layerConfig: { layerId: id, layerName: `Group ${id}`, parentId, layerType: 'layerGroup' },
    visible: true,
  });
}

// ---- Drawing ----

function render() {
  const { rootIds, layers } = manager.getTree();
  list.replaceChildren(...renderLayers(rootIds, layers));
}

// The manager orders layers from the bottom up; the list shows the top layer first.
function renderLayers(layerIds: readonly string[], layers: LayerTree<undefined>['layers']): HTMLElement[] {
  return [...layerIds].reverse().map((layerId) => renderLayer(layers[layerId]!, layers));
}

function renderLayer(info: ManagedLayerInfo<undefined>, layers: LayerTree<undefined>['layers']): HTMLElement {
  const { layerId, layerName, opacity, computedOpacity, visible } = info;
  const icon = info.layerType === 'layerGroup' ? '📁' : '📄';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = info.enabled;
  checkbox.addEventListener('change', () => manager.setEnabled(layerId, checkbox.checked));

  const name = document.createElement('span');
  name.textContent = `${icon} ${layerName} (${visible ? 'visible' : 'hidden'})`;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.1';
  slider.value = String(opacity);
  slider.addEventListener('change', () => manager.setOpacity(layerId, Number(slider.value)));

  const raiseButton = document.createElement('button');
  raiseButton.textContent = '↑';
  raiseButton.title = 'Raise';
  raiseButton.addEventListener('click', () => manager.raiseLayer(layerId));

  const lowerButton = document.createElement('button');
  lowerButton.textContent = '↓';
  lowerButton.title = 'Lower';
  lowerButton.addEventListener('click', () => manager.lowerLayer(layerId));

  const removeButton = document.createElement('button');
  removeButton.textContent = '✕';
  removeButton.title = 'Remove';
  removeButton.addEventListener('click', () => manager.removeLayer(layerId));

  const row = document.createElement('div');
  row.className = `layer-item ${visible ? 'visible' : 'hidden'}`;
  row.style.setProperty('--opacity', String(computedOpacity));
  row.append(checkbox, name, slider, `${Math.round(opacity * 100)}%`, raiseButton, lowerButton, removeButton);

  const wrapper = document.createElement('div');
  wrapper.className = 'layer-wrapper';
  wrapper.append(row);

  if (info.layerType === 'layerGroup') {
    const addLayerButton = document.createElement('button');
    addLayerButton.textContent = '+ Layer';
    addLayerButton.addEventListener('click', () => addLayer(layerId));

    const addGroupButton = document.createElement('button');
    addGroupButton.textContent = '+ Group';
    addGroupButton.addEventListener('click', () => addGroup(layerId));

    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.append(addLayerButton, addGroupButton);

    const children = document.createElement('div');
    children.className = 'children';
    children.append(...renderLayers(info.childIds, layers));

    wrapper.append(controls, children);
  }

  return wrapper;
}

// Newest first, so the latest change is always in view.
function logEvent(hook: string, detail: string) {
  const name = document.createElement('code');
  name.textContent = hook;

  const entry = document.createElement('li');
  entry.append(name, ` ${detail}`);
  log.prepend(entry);
}

// ---- Page ----

document.getElementById('add-layer-btn')!.addEventListener('click', () => addLayer(null));
document.getElementById('add-group-btn')!.addEventListener('click', () => addGroup(null));
