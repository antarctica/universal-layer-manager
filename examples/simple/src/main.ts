import { LayerManager } from '@ulm/core';
import './style.css';

const list = document.getElementById('layer-list')!;

// ---- Layer Manager ----
// Whenever anything changes, draw the whole list again from the manager's state.

const manager = new LayerManager<undefined>({
  allowNestedGroupLayers: true,
  onLayerAdded: render,
  onVisibilityChanged: render,
  onEnabledChanged: render,
  onOpacityChanged: render,
  onOrderChanged: render,
});

function addLayer(parentId: string | null) {
  const id = Math.random().toString(36).substring(7);
  manager.addLayer({
    layerConfig: { layerId: id, layerName: `Layer ${id}`, parentId, layerData: undefined, layerType: 'layer' },
    visible: true,
  });
}

function addGroup(parentId: string | null) {
  const id = Math.random().toString(36).substring(7);
  manager.addGroup({
    layerConfig: { layerId: id, layerName: `Group ${id}`, parentId, layerData: undefined, layerType: 'layerGroup' },
    visible: true,
  });
}

// ---- Drawing ----

function render() {
  list.replaceChildren(...renderLayers(manager.layers.map((item) => item.layerActor.id)));
}

// The manager orders layers from the bottom up; the list shows the top layer first.
function renderLayers(layerIds: string[]): HTMLElement[] {
  return [...layerIds].reverse().map(renderLayer);
}

function renderLayer(layerId: string): HTMLElement {
  const item = manager.getLayer(layerId)!;
  const snapshot = item.layerActor.getSnapshot();
  const { layerName, opacity, computedOpacity } = snapshot.context;
  const visible = snapshot.hasTag('visible');
  const icon = item.type === 'layerGroup' ? '📁' : '📄';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = snapshot.hasTag('enabled');
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

  const row = document.createElement('div');
  row.className = `layer-item ${visible ? 'visible' : 'hidden'}`;
  row.style.setProperty('--opacity', String(computedOpacity));
  row.append(checkbox, name, slider, `${Math.round(opacity * 100)}%`);

  const wrapper = document.createElement('div');
  wrapper.className = 'layer-wrapper';
  wrapper.append(row);

  if (item.type === 'layerGroup') {
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
    children.append(...renderLayers(item.layerActor.getSnapshot().context.childLayerOrder));

    wrapper.append(controls, children);
  }

  return wrapper;
}

// ---- Page ----

document.getElementById('add-layer-btn')!.addEventListener('click', () => addLayer(null));
document.getElementById('add-group-btn')!.addEventListener('click', () => addGroup(null));
