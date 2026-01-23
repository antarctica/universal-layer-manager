import React from 'react';

import { REFERENCEID } from '@/constants/layer-constants';
import {
  convertDateValueToDateYYYYMMDD,
  convertRangeValueToDateRangeString,
  formatDateRangeToDateTime,
  getInitialTimeInfo,
} from '@/lib/helpers/date';
import { isRangeTimeInfo, isSingleTimeInfo } from '@/lib/machines/layerManager/types';
import { GroupLayer, Pole } from '@/lib/types';

import layerSourcesManager from '../layerSources/layerSources';
import PolarWmsSource from '../layerSources/leaflet-polar-wms-source';
import WFSLayerSAR from '../layerSources/leaflet-wfs-source';
import WFSLayer from '../layerSources/leaflet-wfs-source';
import WMTSTileLayer from '../layerSources/leaflet-wmts-source';
import { useTooltipSetters } from '../MapTooltip/useTooltipSetters';
import { useIsMapInitialisedWithLayers } from './hooks/useIsMapInitialisedWithLayers';
import { LayerManagerContext } from './LayerManagerProvider';
import { useLayerOperations } from './utils';

interface MapContextProps {
  groupLayerConfig: GroupLayer[];
  pole: Pole;
  map: L.Map | null;
  mapLayersInitialised: boolean;
}

export const MapContext = React.createContext<MapContextProps>({
  groupLayerConfig: [],
  pole: 'North',
  map: null,
  mapLayersInitialised: false,
});

interface MapProviderProps {
  children: React.ReactNode;
  map: L.Map | null;
  initialLayerConfig: GroupLayer[];
  pole: Pole;
}

export const MapProvider = ({ children, map, initialLayerConfig, pole }: MapProviderProps) => {
  const layerManagerActor = LayerManagerContext.useActorRef();
  const mapLayersInitialised = useIsMapInitialisedWithLayers(initialLayerConfig);
  const tooltipSetters = useTooltipSetters();
  const { addLayerToMap } = useLayerOperations();
  React.useEffect(() => {
    if (!map) return;

    const addLayerToMapHandler = layerManagerActor.on('LAYER.ADDED', ({ layerId, visible }) => {
      const layerSource = layerSourcesManager.getLayerSource(layerId);
      if (layerSource && visible) {
        layerSource.layer.addTo(map);
      }
    });

    const removeLayerFromMapHandler = layerManagerActor.on('LAYER.REMOVED', ({ layerId }) => {
      const layerSource = layerSourcesManager.getLayerSource(layerId);
      if (layerSource) {
        layerSource.layer.removeFrom(map);
        layerSourcesManager.removeLayerSource(layerId);
      }
    });

    const layerOrderChangeHandler = layerManagerActor.on(
      'LAYER.ORDER_CHANGED',
      ({ layerOrder }) => {
        for (const layerId of layerOrder) {
          const pane = map.getPane(layerId);
          if (pane) {
            pane.style.zIndex = (layerOrder.indexOf(layerId) + 100).toString();
          }
        }
      },
    );

    const layerOpacityChangeHandler = layerManagerActor.on(
      'LAYER.OPACITY_CHANGED',
      ({ layerId, opacity }) => {
        const layerSource = layerSourcesManager.getLayerSource(layerId)?.layer;
        if (layerSource instanceof PolarWmsSource) {
          layerSource.updateWmsParams({ opacity });
        }
        if (layerSource instanceof WMTSTileLayer) {
          layerSource.setOpacity(opacity);
        }
        if (layerSource instanceof WFSLayer) {
          layerSource.setOpacity(opacity);
        }
      },
    );

    const layerVisibilityChangeHandler = layerManagerActor.on(
      'LAYER.VISIBILITY_CHANGED',
      ({ layerId, visible }) => {
        const layerSource = layerSourcesManager.getLayerSource(layerId);
        if (layerSource) {
          if (visible) {
            layerSource.layer.addTo(map);
          } else {
            layerSource.layer.removeFrom(map);
          }
        }
      },
    );

    const timeInfoChangedHandle = layerManagerActor.on(
      'LAYER.TIME_INFO_CHANGED',
      ({ layerId, timeInfo }) => {
        const layerSource = layerSourcesManager.getLayerSource(layerId);
        if (!layerSource) return;
        const { layer } = layerSource;

        if (isSingleTimeInfo(timeInfo)) {
          if (layer instanceof PolarWmsSource) {
            const date = convertDateValueToDateYYYYMMDD(timeInfo.value);
            layer.updateWmsParams({ time: date });
          }
        }

        if (isRangeTimeInfo(timeInfo)) {
          if (layer instanceof WFSLayerSAR) {
            const dateRangeString = convertRangeValueToDateRangeString(timeInfo);
            const dateTimeStringRange = formatDateRangeToDateTime(dateRangeString);
            layer.layerDefinition = `acqtime DURING ${dateTimeStringRange}`;
          }
        }
      },
    );

    layerManagerActor.send({
      type: 'LAYER.ADD',
      params: {
        layerConfig: {
          layerId: REFERENCEID,
          layerName: 'Reference',
          layerType: 'layerGroup',
          parentId: null,
          layerData: null,
          listMode: 'hide',
        },
        visible: true,
      },
    });

    initialLayerConfig.forEach((group) => {
      layerManagerActor.send({
        type: 'LAYER.ADD',
        params: {
          layerConfig: {
            layerId: group.id,
            layerName: group.label,
            layerType: 'layerGroup',
            parentId: null,
            listMode: group.showInLayerList ? 'show' : 'hide',
            layerData: null,
          },
          visible: group.visible,
        },
      });

      group.layers.forEach((baseLayer) => {
        const timeInfo = getInitialTimeInfo(baseLayer.timeSettings);
        layerSourcesManager.createLayerSource(map, baseLayer, tooltipSetters, group);
        addLayerToMap({
          config: {
            layerConfig: {
              layerId: baseLayer.id,
              layerName: baseLayer.label,
              layerType: 'layer',
              timeInfo,
              parentId: baseLayer.referenceLayer ? REFERENCEID : group.id,
              layerData: {
                layerSourceType: baseLayer.type,
                timeSettings: baseLayer.timeSettings,
              },
            },
            visible: baseLayer.visible,
            position: 'top',
          },
        });
      });
    });

    return () => {
      layerOpacityChangeHandler.unsubscribe();
      layerVisibilityChangeHandler.unsubscribe();
      timeInfoChangedHandle.unsubscribe();
      removeLayerFromMapHandler.unsubscribe();
      addLayerToMapHandler.unsubscribe();
      layerOrderChangeHandler.unsubscribe();
      layerSourcesManager.getAllLayerSources().forEach((layerSource) => {
        layerSource.layer.removeFrom(map);
        layerSourcesManager.removeLayerSource(layerSource.layerConfig.id);
      });
      layerManagerActor.send({
        type: 'RESET',
      });
    };
  }, [layerManagerActor, map, tooltipSetters, initialLayerConfig, addLayerToMap]);

  const providedValue = React.useMemo(() => {
    return {
      groupLayerConfig: initialLayerConfig,
      pole,
      map,
      mapLayersInitialised,
    };
  }, [initialLayerConfig, pole, map, mapLayersInitialised]);

  return <MapContext.Provider value={providedValue}>{children}</MapContext.Provider>;
};

export function useMapProvider() {
  return React.useContext(MapContext);
}
