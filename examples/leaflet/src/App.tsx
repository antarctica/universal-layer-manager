import { LayerList } from './components/LayerList/LayerList';
import { LeafletMap } from './components/LeafletMap';
import { LayerManagerProvider } from './layerManager/LayerManagerProvider';

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
