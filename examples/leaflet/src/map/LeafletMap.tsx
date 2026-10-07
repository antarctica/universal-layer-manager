import type { LayerData } from '../layers/manager';
import { LeafletLayerManagerAdapter } from '@ulm/leaflet';
import * as L from 'leaflet';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import * as React from 'react';
import { MapContainer, useMap } from 'react-leaflet';
import { useLayerManager } from '../layers/LayerManagerProvider';
import { LONDON } from '../layers/manager';
import 'leaflet/dist/leaflet.css';

// The bundler renames Leaflet's default marker images, so point Leaflet at the bundled copies.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: icon, iconRetinaUrl: iconRetina, shadowUrl: iconShadow });

// Attaches the manager to the map while the map is mounted. The manager replays its layers on attach.
function AttachLayerManager(): null {
  const map = useMap();
  const manager = useLayerManager();

  React.useEffect(() => {
    manager.setAdapter(new LeafletLayerManagerAdapter<LayerData>(map));
    return () => manager.setAdapter(null);
  }, [map, manager]);

  return null;
}

export function LeafletMap(): React.ReactElement {
  return (
    <MapContainer center={LONDON} zoom={13} style={{ height: '100%', width: '100%' }}>
      <AttachLayerManager />
    </MapContainer>
  );
}
