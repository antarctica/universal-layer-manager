import * as React from 'react';
import { useTopLevelActors } from '../layers/LayerManagerContext';
import { AddLayerButtons } from './AddLayerButtons';
import { LayerRows } from './LayerRow';

export function LayerList(): React.ReactElement {
  const actors = useTopLevelActors();

  return (
    <div>
      <AddLayerButtons parentId={null} />
      <LayerRows actors={actors} />
    </div>
  );
}
