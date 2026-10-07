import type { MapLibreLayerStyle, SourceSpecification } from '@ulm/maplibre';

// Each layer is a MapLibre style: the sources it reads and its style layers, bottom first.
// The vector layers all name the OpenFreeMap source, so they share it and load its tiles once.

const OPENFREEMAP: SourceSpecification = {
  type: 'vector',
  url: 'https://tiles.openfreemap.org/planet',
};

export const satellite: MapLibreLayerStyle = {
  sources: {
    imagery: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'imagery', type: 'raster', source: 'imagery' }],
};

export const elevation: MapLibreLayerStyle = {
  sources: {
    terrain: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json', tileSize: 512, encoding: 'terrarium' },
  },
  layers: [{
    id: 'relief',
    type: 'color-relief',
    source: 'terrain',
    paint: {
      'color-relief-color': ['interpolate', ['linear'], ['elevation'], 0, '#1a9641', 50, '#ffffbf', 100, '#d7191c'],
    },
  }],
};

export const parks: MapLibreLayerStyle = {
  sources: { openfreemap: OPENFREEMAP },
  layers: [{ 'id': 'parks', 'type': 'fill', 'source': 'openfreemap', 'source-layer': 'park', 'paint': { 'fill-color': '#2e7d32', 'fill-opacity': 0.5 } }],
};

export const waterways: MapLibreLayerStyle = {
  sources: { openfreemap: OPENFREEMAP },
  layers: [{ 'id': 'waterways', 'type': 'line', 'source': 'openfreemap', 'source-layer': 'waterway', 'paint': { 'line-color': '#1e88e5', 'line-width': 3 } }],
};

export const railways: MapLibreLayerStyle = {
  sources: { openfreemap: OPENFREEMAP },
  layers: [{
    'id': 'railways',
    'type': 'line',
    'source': 'openfreemap',
    'source-layer': 'transportation',
    'filter': ['==', ['get', 'class'], 'rail'],
    'paint': { 'line-color': '#e65100', 'line-width': 2 },
  }],
};

export const buildings: MapLibreLayerStyle = {
  sources: { openfreemap: OPENFREEMAP },
  layers: [{
    'id': 'buildings',
    'type': 'fill-extrusion',
    'source': 'openfreemap',
    'source-layer': 'building',
    'minzoom': 14,
    'paint': {
      'fill-extrusion-color': '#9e9ac8',
      'fill-extrusion-height': ['get', 'render_height'],
      'fill-extrusion-base': ['get', 'render_min_height'],
    },
  }],
};
