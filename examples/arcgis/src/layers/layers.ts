import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer.js';

// Every layer is a public feature service on ArcGIS Online, loaded from its portal item so it keeps the style and
// popup its publisher gave it. A layer whose item has no popup gets one that lists its fields.

function fromPortalItem(id: string, layerId = 0): FeatureLayer {
  const layer = new FeatureLayer({ portalItem: { id }, layerId });
  layer
    .when(() => {
      layer.popupTemplate ??= layer.createPopupTemplate();
    })
    .catch((error: unknown) => console.warn(`Layer ${id} failed to load`, error));
  return layer;
}

// British Antarctic Survey: the latest position of each tracked vehicle, aircraft and ship.
export const assetLocations = fromPortalItem('54a2070f3d6943a29a635c0761e19301');

// Antarctic Digital Database, published by the British Antarctic Survey. The contours are high resolution vector
// tiles with their heights labelled; the other layers are medium resolution.
export const contours = new VectorTileLayer({ portalItem: { id: '9f22b4a3f0ea4877839f5a829366dac1' } });
export const coastline = fromPortalItem('09173a4364cc4636928833b71cfb7021', 1);
export const rockOutcrop = fromPortalItem('45596ea209f9430682f573f9275c9e8c');
export const lakes = fromPortalItem('bf7a5725e96d4229a5e1153cf4f5002c');
