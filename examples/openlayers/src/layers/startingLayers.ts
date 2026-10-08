import type { EncodedExpression } from 'ol/expr/expression.js';
import MVT from 'ol/format/MVT.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import XYZ from 'ol/source/XYZ.js';

// The OpenLayers layer of each starting layer. The vector layers share one OpenFreeMap source, and each draws the
// features of one of its source layers.

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const OPENFREEMAP_TILEJSON = 'https://tiles.openfreemap.org/planet';

export const satellite = new TileLayer({
  source: new XYZ({
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    attributions: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  }),
});

export const hillshade = new TileLayer({
  source: new XYZ({
    url: `${ESRI}/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}`,
    attributions: 'Hillshade &copy; Esri',
    maxZoom: 16,
  }),
});

const openfreemap = new VectorTileSource({
  format: new MVT(),
  maxZoom: 14,
  attributions: '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
});

// OpenFreeMap dates its current tiles in their URL, so the source reads the URL from the TileJSON.
async function loadOpenFreeMapTiles(): Promise<void> {
  const response = await fetch(OPENFREEMAP_TILEJSON);
  const { tiles }: { tiles: string[] } = await response.json();
  openfreemap.setUrls(tiles);
}

loadOpenFreeMapTiles().catch((error: unknown) => console.warn('OpenFreeMap tiles did not load', error));

// MVT keeps the name of a feature's source layer in its `layer` property.
function inSourceLayer(sourceLayer: string): EncodedExpression {
  return ['==', ['get', 'layer'], sourceLayer];
}

export const parks = new VectorTileLayer({
  source: openfreemap,
  style: [{ filter: inSourceLayer('park'), style: { 'fill-color': 'rgba(46, 125, 50, 0.5)' } }],
});

export const waterways = new VectorTileLayer({
  source: openfreemap,
  style: [{ filter: inSourceLayer('waterway'), style: { 'stroke-color': '#1e88e5', 'stroke-width': 3 } }],
});

export const railways = new VectorTileLayer({
  source: openfreemap,
  style: [{
    filter: ['all', inSourceLayer('transportation'), ['==', ['get', 'class'], 'rail']],
    style: { 'stroke-color': '#e65100', 'stroke-width': 2 },
  }],
});

export const buildings = new VectorTileLayer({
  source: openfreemap,
  minZoom: 14,
  style: [{
    filter: inSourceLayer('building'),
    style: { 'fill-color': 'rgba(158, 154, 200, 0.8)', 'stroke-color': '#6a51a3', 'stroke-width': 1 },
  }],
});
