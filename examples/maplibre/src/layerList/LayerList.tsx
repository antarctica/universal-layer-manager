import * as React from 'react';
import { useLayerTree } from '../layers/LayerManagerProvider';
import { AddLayerButtons } from './AddLayerButtons';
import { LayerRows } from './LayerRow';

export function LayerList(): React.ReactElement {
  const { rootIds } = useLayerTree();

  return (
    <div>
      <AddLayerButtons parentId={null} />
      <LayerRows layerIds={rootIds} />
    </div>
  );
}
