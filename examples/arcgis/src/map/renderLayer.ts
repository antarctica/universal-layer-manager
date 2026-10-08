import type { ArcGISRenderLayer } from '@ulm/arcgis';
import type { LayerData } from '../layers/manager';
import TimeExtent from '@arcgis/core/time/TimeExtent.js';
import { defaultArcGISRenderLayer } from '@ulm/arcgis';
import { isSingleTimeInfo } from '@ulm/core';
import { Temporal } from 'temporal-polyfill';

// Shows each layer's ArcGIS layer, set to the day its time info holds. The adapter calls this again when the time
// changes; returning the same layer keeps it on the map, and ArcGIS loads that day's data.
export const renderLayer: ArcGISRenderLayer<LayerData> = (info) => {
  const arcgisLayer = defaultArcGISRenderLayer(info);
  if (arcgisLayer && 'timeExtent' in arcgisLayer && isSingleTimeInfo(info.timeInfo)) {
    const day = new Date(Temporal.PlainDate.from(info.timeInfo.value).toZonedDateTime('UTC').epochMilliseconds);
    arcgisLayer.timeExtent = new TimeExtent({ start: day, end: day });
  }
  return arcgisLayer;
};
