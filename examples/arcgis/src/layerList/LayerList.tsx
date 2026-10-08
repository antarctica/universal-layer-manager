import * as React from 'react';
import { useLayerTree } from '../layers/LayerManagerProvider';
import { LayerRows } from './LayerRow';

export function LayerList(): React.ReactElement {
  const { rootIds } = useLayerTree();

  return (
    <div>
      <LayerRows layerIds={rootIds} />
    </div>
  );
}
