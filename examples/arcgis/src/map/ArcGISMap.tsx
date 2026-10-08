import type { LayerData } from '../layers/manager';
import Basemap from '@arcgis/core/Basemap.js';
import Extent from '@arcgis/core/geometry/Extent.js';
import SpatialReference from '@arcgis/core/geometry/SpatialReference.js';
import EsriMap from '@arcgis/core/Map.js';
import { ArcGISLayerManagerAdapter } from '@ulm/arcgis';
import * as React from 'react';
import { useLayerManager } from '../layers/LayerManagerProvider';
import { renderLayer } from './renderLayer';
import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-zoom';

// "Antarctica and the Southern Ocean", the British Antarctic Survey basemap built on the Antarctic Digital Database.
const BAS_BASEMAP_ID = '435e23642bf94b83b07d1d3fc0c5c9d5';

const ANTARCTIC_POLAR_STEREOGRAPHIC = new SpatialReference({ wkid: 3031 });

const ANTARCTICA = new Extent({ xmin: -3e6, ymin: -3e6, xmax: 3e6, ymax: 3e6, spatialReference: ANTARCTIC_POLAR_STEREOGRAPHIC });

// The map, with the manager attached while it is mounted. The adapter keeps the manager's layers in a group of its own
// on the map.
export function ArcGISMap(): React.ReactElement {
  const manager = useLayerManager();
  const [map] = React.useState(() => new EsriMap({ basemap: new Basemap({ portalItem: { id: BAS_BASEMAP_ID } }) }));

  // <arcgis-map> destroys its map, and every layer on it, once React removes it. A layout effect's cleanup runs
  // before that, so detaching here takes the manager's layers off the map first.
  React.useLayoutEffect(() => {
    manager.setAdapter(new ArcGISLayerManagerAdapter<LayerData>(map, { renderLayer }));
    return () => manager.setAdapter(null);
  }, [manager, map]);

  return (
    <arcgis-map
      map={map}
      spatialReference={ANTARCTIC_POLAR_STEREOGRAPHIC}
      extent={ANTARCTICA}
      popupComponentEnabled
      style={{ height: '100%', width: '100%' }}
    >
      <arcgis-zoom slot="top-left" />
    </arcgis-map>
  );
}
