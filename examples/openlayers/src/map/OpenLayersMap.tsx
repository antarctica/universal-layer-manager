import type { LayerData } from '../layers/manager';
import type { Basemap } from './basemaps';
import { OpenLayersLayerManagerAdapter } from '@ulm/openlayers';
import LayerGroup from 'ol/layer/Group.js';
import TileLayer from 'ol/layer/Tile.js';
import OlMap from 'ol/Map.js';
import { fromLonLat } from 'ol/proj.js';
import XYZ from 'ol/source/XYZ.js';
import View from 'ol/View.js';
import * as React from 'react';
import { useLayerManager } from '../layers/LayerManagerProvider';
import { LONDON } from '../layers/manager';
import 'ol/ol.css';

interface BasemapLayers {
  base: TileLayer<XYZ>;
  labels: TileLayer<XYZ>;
}

// The map, with the manager attached while it is mounted. The basemap is two layers of the app's own, the map and its
// labels, and the adapter draws the manager's layers in a group between them.
export function OpenLayersMap({ basemap }: { basemap: Basemap }): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const basemapRef = React.useRef<BasemapLayers | null>(null);
  const manager = useLayerManager();

  // Effects run in order, so on mount the basemap layers exist before the effect below gives them their tiles.
  React.useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const base = new TileLayer<XYZ>();
    const labels = new TileLayer<XYZ>();
    const managedLayers = new LayerGroup();
    const map = new OlMap({
      target: containerRef.current,
      layers: [base, managedLayers, labels],
      view: new View({ center: fromLonLat(LONDON), zoom: 10 }),
    });
    manager.setAdapter(new OpenLayersLayerManagerAdapter<LayerData>(map, { container: managedLayers }));
    basemapRef.current = { base, labels };

    return () => {
      basemapRef.current = null;
      manager.setAdapter(null);
      map.setTarget(undefined);
    };
  }, [manager]);

  React.useEffect(() => {
    basemapRef.current?.base.setSource(new XYZ({ url: basemap.base, attributions: basemap.attribution, maxZoom: 16 }));
    basemapRef.current?.labels.setSource(new XYZ({ url: basemap.labels, maxZoom: 16 }));
  }, [basemap]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
