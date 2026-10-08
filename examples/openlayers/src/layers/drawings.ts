import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { circular } from 'ol/geom/Polygon.js';
import VectorLayer from 'ol/layer/Vector.js';
import { fromLonLat } from 'ol/proj.js';
import VectorSource from 'ol/source/Vector.js';

const AREA_RADIUS_M = 5000;

export function pointLayer(place: [number, number]): VectorLayer {
  return new VectorLayer({
    source: new VectorSource({ features: [new Feature(new Point(fromLonLat(place)))] }),
    style: { 'circle-radius': 8, 'circle-fill-color': '#ff6f00', 'circle-stroke-color': 'white', 'circle-stroke-width': 2 },
  });
}

// A 5 km circle, filled and outlined in `colour`. `circular` draws it on the globe, in longitude and latitude.
export function areaLayer(centre: [number, number], [red, green, blue]: [number, number, number]): VectorLayer {
  const area = circular(centre, AREA_RADIUS_M, 64).transform('EPSG:4326', 'EPSG:3857');
  return new VectorLayer({
    source: new VectorSource({ features: [new Feature(area)] }),
    style: { 'fill-color': [red, green, blue, 0.5], 'stroke-color': [red, green, blue, 1], 'stroke-width': 2 },
  });
}
