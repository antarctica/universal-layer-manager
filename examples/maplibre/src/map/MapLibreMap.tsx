import type { LayerData } from '../layers/manager';
import { MapLibreLayerManagerAdapter } from '@ulm/maplibre';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import * as React from 'react';
import { useLayerManager } from '../layers/LayerManagerProvider';
import { LONDON } from '../layers/manager';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre finds its worker next to its own file, which a bundle moves. Vite builds the worker and gives its URL.
maplibregl.setWorkerUrl(workerUrl);

// The map, with the manager attached while it is mounted. The adapter draws the manager's layers below the basemap's
// labels once the basemap has loaded, and again after each switch.
export function MapLibreMap({ basemap }: { basemap: string }): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const manager = useLayerManager();

  // Effects run in order, so on mount the map exists before the effect below gives it the basemap.
  React.useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const map = new maplibregl.Map({ container: containerRef.current, center: LONDON, zoom: 10 });
    map.addControl(new maplibregl.NavigationControl());
    manager.setAdapter(new MapLibreLayerManagerAdapter<LayerData>(map));
    mapRef.current = map;

    return () => {
      mapRef.current = null;
      manager.setAdapter(null);
      map.remove();
    };
  }, [manager]);

  React.useEffect(() => {
    mapRef.current?.setStyle(basemap);
  }, [basemap]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
