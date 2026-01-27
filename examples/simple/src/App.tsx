import { LayerList } from './components/LayerList/LayerList';
import { LayerManagerProvider } from './layerManager/LayerManagerProvider';

export default function App() {
  return (
    <LayerManagerProvider>
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Layer Manager Demo</h1>
        <LayerList />
      </div>
    </LayerManagerProvider>
  );
}
