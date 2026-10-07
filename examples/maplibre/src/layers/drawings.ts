import type { Polygon } from 'geojson';
import type { LayerData } from './manager';

const AREA_RADIUS_KM = 5;
const KM_PER_DEGREE = 111.32;

export function pointStyle(id: string, [lng, lat]: [number, number]): LayerData {
  return {
    sources: { [id]: { type: 'geojson', data: { type: 'Point', coordinates: [lng, lat] } } },
    layers: [{
      id,
      type: 'circle',
      source: id,
      paint: { 'circle-radius': 8, 'circle-color': '#ff6f00', 'circle-stroke-color': 'white', 'circle-stroke-width': 2 },
    }],
  };
}

function circle([lng, lat]: [number, number], radiusKm: number): Polygon {
  const latRadius = radiusKm / KM_PER_DEGREE;
  const lngRadius = latRadius / Math.cos((lat * Math.PI) / 180);
  const ring = Array.from({ length: 65 }, (_, index) => {
    const angle = (index / 64) * 2 * Math.PI;
    return [lng + lngRadius * Math.cos(angle), lat + latRadius * Math.sin(angle)];
  });
  return { type: 'Polygon', coordinates: [ring] };
}

// A 5 km circle, filled and outlined in `colour`.
export function areaStyle(id: string, centre: [number, number], colour: string): LayerData {
  return {
    sources: { [id]: { type: 'geojson', data: circle(centre, AREA_RADIUS_KM) } },
    layers: [
      { id: `${id}-fill`, type: 'fill', source: id, paint: { 'fill-color': colour, 'fill-opacity': 0.5 } },
      { id: `${id}-outline`, type: 'line', source: id, paint: { 'line-color': colour, 'line-width': 2 } },
    ],
  };
}
