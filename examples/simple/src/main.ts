import type { ManagedLayerInfo } from '@ulm/core';
import { LayerManager } from '@ulm/core';
import './style.css';

// ---- Helpers ----

function randomId() {
  return Math.random().toString(36).substring(7);
}

function getLayerEl(layerId: string) {
  return document.querySelector<HTMLElement>(`[data-layer-id="${layerId}"]`);
}

// ---- Layer Manager ----
const manager = new LayerManager({
  allowNestedGroupLayers: true,

  onLayerAdded(info) {
    const el = buildLayerEl(info);
    const parentEl = info.parentId
      ? getLayerEl(info.parentId)?.querySelector<HTMLElement>('.children')
      : document.getElementById('layer-list');
    parentEl?.appendChild(el);
  },

  onVisibilityChanged(info, visible) {
    const wrapper = getLayerEl(info.layerId);
    if (!wrapper) {
      return;
    }
    wrapper.querySelector('.layer-item')?.classList.toggle('visible', visible);
    wrapper.querySelector('.layer-item')?.classList.toggle('hidden', !visible);
    const icon = info.layerType === 'layerGroup' ? '📁' : '📄';
    const label = wrapper.querySelector('.layer-label-text');
    if (label) {
      label.textContent = `${icon} ${info.layerName} (${visible ? 'visible' : 'hidden'})`;
    }
    const checkbox = wrapper.querySelector<HTMLInputElement>('.layer-checkbox');
    if (checkbox) {
      checkbox.checked = visible;
    }
  },

  onOpacityChanged(info, computedOpacity) {
    const wrapper = getLayerEl(info.layerId);
    if (!wrapper) {
      return;
    }
    wrapper.querySelector<HTMLElement>('.layer-item')?.style.setProperty('--opacity', computedOpacity.toString());
    const slider = wrapper.querySelector<HTMLInputElement>('.opacity-slider');
    if (slider) {
      slider.value = info.opacity.toString();
    }
    const label = wrapper.querySelector('.opacity-value');
    if (label) {
      label.textContent = `${Math.round(info.opacity * 100)}%`;
    }
  },
});

// ---- Add layer / group ----

function addLayer(parentId: string | null) {
  const id = randomId();
  manager.addLayer({
    layerConfig: {
      layerId: id,
      layerName: `Layer ${id}`,
      parentId,
      layerData: undefined,
      layerType: 'layer',
    },
    visible: true,
  });
}

function addGroup(parentId: string | null) {
  const id = randomId();
  manager.addGroup({
    layerConfig: {
      layerId: id,
      layerName: `Group ${id}`,
      parentId,
      layerData: undefined,
      layerType: 'layerGroup',
    },
    visible: true,
  });
}

// ---- Build DOM element for a layer or group ----

function buildLayerEl(info: ManagedLayerInfo) {
  const isGroup = info.layerType === 'layerGroup';
  const icon = isGroup ? '📁' : '📄';

  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-layer-id', info.layerId);
  wrapper.className = 'layer-wrapper';

  // --- Row ---
  const layerItem = document.createElement('div');
  layerItem.className = `layer-item ${info.visible ? 'visible' : 'hidden'}`;
  layerItem.style.setProperty('--opacity', info.computedOpacity.toString());

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'layer-checkbox';
  checkbox.checked = info.visible;
  checkbox.addEventListener('change', () => manager.setVisibility(info.layerId, checkbox.checked));

  const labelText = document.createElement('span');
  labelText.className = 'layer-label-text';
  labelText.textContent = `${icon} ${info.layerName} (${info.visible ? 'visible' : 'hidden'})`;

  const label = document.createElement('label');
  label.className = 'layer-label';
  label.append(checkbox, labelText);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.1';
  slider.value = info.opacity.toString();
  slider.className = 'opacity-slider';
  slider.addEventListener('input', () => manager.setOpacity(info.layerId, Number(slider.value)));

  const opacityLabel = document.createElement('span');
  opacityLabel.className = 'opacity-value';
  opacityLabel.textContent = `${Math.round(info.opacity * 100)}%`;

  const opacityControls = document.createElement('div');
  opacityControls.className = 'opacity-controls';
  opacityControls.append(slider, opacityLabel);

  layerItem.append(label, opacityControls);
  wrapper.append(layerItem);

  // --- Group: child controls + container ---
  if (isGroup) {
    const addLayerBtn = document.createElement('button');
    addLayerBtn.textContent = '+ Layer';
    addLayerBtn.addEventListener('click', () => addLayer(info.layerId));

    const addGroupBtn = document.createElement('button');
    addGroupBtn.textContent = '+ Group';
    addGroupBtn.addEventListener('click', () => addGroup(info.layerId));

    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.append(addLayerBtn, addGroupBtn);

    const children = document.createElement('div');
    children.className = 'children';

    wrapper.append(controls, children);
  }

  return wrapper;
}

// ---- Root buttons ----

document.getElementById('add-layer-btn')!.addEventListener('click', () => addLayer(null));
document.getElementById('add-group-btn')!.addEventListener('click', () => addGroup(null));
