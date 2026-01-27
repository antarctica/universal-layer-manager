import * as L from 'leaflet';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';

import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { LayerList } from './components/LayerList/LayerList';
import { LeafletMap } from './components/LeafletMap';
import { LayerManagerProvider } from './layerManager/LayerManagerProvider';

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
});

// Simple side‑by‑side layout:
// - Left: controls for adding, grouping and toggling layers
// - Right: Leaflet map that renders the active layers
function MapWithLayers() {
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <section
        style={{
          width: '350px',
          padding: '20px',
          overflowY: 'auto',
          borderRight: '1px solid #ccc',
        }}
      >
        <h1 style={{ marginTop: 0 }}>Layer Manager</h1>
        <p style={{ marginTop: 0 }}>
          Use the controls below to add markers or groups, and to toggle visibility or opacity.
        </p>
        <LayerList />
      </section>
      <main style={{ flex: 1, position: 'relative' }}>
        <LeafletMap />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LayerManagerProvider>
      <MapWithLayers />
    </LayerManagerProvider>
  );
}
