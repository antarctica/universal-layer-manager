import L from 'leaflet';
import { useLayerManager } from '../../layerManager/LayerManagerProvider';
import { clampedNormalize } from '../../utils';
import Button from '../Button/Button';
import styles from './LayerList.module.css';

const LONDON_LATITUDE = 51.505;
const LONDON_LONGITUDE = -0.09;
const RANDOM_MARKER_OFFSET = 0.05;

function createRandomMarkerNearLondon(id: string) {
  const deltaLat = clampedNormalize(Math.random(), 0, 1, -RANDOM_MARKER_OFFSET, RANDOM_MARKER_OFFSET);
  const deltaLng = clampedNormalize(Math.random(), 0, 1, -RANDOM_MARKER_OFFSET, RANDOM_MARKER_OFFSET);

  const lat = LONDON_LATITUDE + deltaLat;
  const lng = LONDON_LONGITUDE + deltaLng;

  const marker = L.marker([lat, lng]) as L.Marker;
  marker.bindPopup(`Marker ${id}`);

  return marker;
}

function createRandomId() {
  return Math.random().toString(36).substring(7);
}

interface LayerControlsProps {
  parentId: string | null;
  indent: number;
}

// Adds layers or groups under the given parent, indented visually to show nesting.
export function LayerControls({ parentId, indent }: LayerControlsProps) {
  const manager = useLayerManager();

  const handleAddLayer = () => {
    const id = createRandomId();
    const marker = createRandomMarkerNearLondon(id);

    manager.addLayer({
      layerConfig: {
        layerId: id,
        layerName: `Marker ${id}`,
        parentId,
        layerData: { leafletLayer: marker },
        layerType: 'layer',
      },
      visible: true,
    });
  };

  const handleAddGroup = () => {
    const id = createRandomId();

    manager.addGroup({
      layerConfig: {
        layerId: id,
        layerName: `Group ${id}`,
        parentId,
        layerData: undefined,
        layerType: 'layerGroup',
      },
      visible: true,
    });
  };

  return (
    <div className={styles.controls} style={{ marginLeft: `${indent * 20}px` }}>
      <Button onPress={handleAddLayer}>+ Layer</Button>
      <Button onPress={handleAddGroup}>+ Group</Button>
    </div>
  );
}
