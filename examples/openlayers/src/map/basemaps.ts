// Esri's raster basemaps, which need no API key. Each comes as the map without labels and the labels alone, so the
// managed layers can be drawn between them.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

function tiles(service: string): string {
  return `${ESRI}/${service}/MapServer/tile/{z}/{y}/{x}`;
}

export interface Basemap {
  name: string;
  base: string;
  labels: string;
  attribution: string;
}

export const BASEMAPS: Basemap[] = [
  {
    name: 'Light Gray',
    base: tiles('Canvas/World_Light_Gray_Base'),
    labels: tiles('Canvas/World_Light_Gray_Reference'),
    attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community',
  },
  {
    name: 'Dark Gray',
    base: tiles('Canvas/World_Dark_Gray_Base'),
    labels: tiles('Canvas/World_Dark_Gray_Reference'),
    attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community',
  },
  {
    name: 'Oceans',
    base: tiles('Ocean/World_Ocean_Base'),
    labels: tiles('Ocean/World_Ocean_Reference'),
    attribution: 'Esri, Garmin, GEBCO, NOAA NGDC, and other contributors',
  },
];
