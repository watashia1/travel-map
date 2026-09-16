import type { MapLibreStyleId } from '../types';

export const DEFAULT_MAPLIBRE_STYLE_ID: MapLibreStyleId = 'liberty';

export const MAPLIBRE_STYLE_OPTIONS: ReadonlyArray<{
  id: MapLibreStyleId;
  label: string;
}> = [
  { id: 'liberty', label: 'OpenFreeMap 彩色' },
  { id: 'positron', label: 'OpenFreeMap 白底' },
  { id: 'natural-earth', label: '离线内置矢量 (免外网)' },
  { id: 'osm-standard', label: '标准 OpenStreetMap' },
  { id: 'travel-clean', label: '旅行极简 (兼容模式)' },
];
