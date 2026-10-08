import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import TileLayer from '@arcgis/core/layers/TileLayer.js';
import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer.js';
import WMSLayer from '@arcgis/core/layers/WMSLayer.js';

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

// Daily AMSR2 sea ice concentration from the University of Bremen, served by the Ice Logistics Portal's GeoServer.
// The layer shows its own time, set from the manager in renderLayer, rather than the view's.
export const seaIceConcentration = new WMSLayer({
  url: 'https://geos.polarview.aq/geoserver/ilp/wms',
  sublayers: [{ name: 'amsr2_hr_s' }],
  copyright: 'AMSR2: University of Bremen',
  useViewTime: false,
});

// Bedmap3, the British Antarctic Survey's map of Antarctica under the ice, as tiled images. The grounding line, from
// NASA MEaSUREs, is where the ice sheet lifts off the bed and starts to float.
export const bedTopography = new TileLayer({ portalItem: { id: '1aa7697adc624c1590b15592871a2795' } });
export const iceThickness = new TileLayer({ portalItem: { id: '95fd2a12049647f5804fac27a440a56d' } });
export const groundingLine = fromPortalItem('066794e7702b485abe6175c82eb17819');

// Antarctic Digital Database, published by the British Antarctic Survey. The contours are high resolution vector
// tiles with their heights labelled; the other layers are medium resolution.
export const contours = new VectorTileLayer({ portalItem: { id: '9f22b4a3f0ea4877839f5a829366dac1' } });
export const coastline = fromPortalItem('09173a4364cc4636928833b71cfb7021', 1);
export const rockOutcrop = fromPortalItem('45596ea209f9430682f573f9275c9e8c');
export const lakes = fromPortalItem('bf7a5725e96d4229a5e1153cf4f5002c');
