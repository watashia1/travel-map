export interface PlaceRecord {
  name: string;
  displayName: string;
  aliases: string[];
  lat: number;
  lon: number;
  country: string;
}

export interface Place {
  id: string;
  rawInput: string;
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  country?: string;
  source: 'coordinates' | 'local-place-db' | 'manual';
  order: number;
  status: 'resolved' | 'ambiguous' | 'unresolved';
  ambiguousCandidates?: PlaceRecord[];
  manualOffsetX?: number;
  manualOffsetY?: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
}

export type RouteType = 'curved' | 'straight';
export type DashStyle = 'solid' | 'dashed' | 'dotted';

export interface RouteStyle {
  type: RouteType;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  dashStyle: DashStyle;
  showArrows: boolean;
}

export type MarkerType = 'dot' | 'numbered' | 'ring';

export interface MarkerStyle {
  type: MarkerType;
  color: string;
  size: number;
  strokeColor: string;
  strokeWidth: number;
}

export interface LabelStyle {
  fontSize: number;
  color: string;
  showHalo: boolean;
  fontWeight: 'normal' | 'medium' | 'bold';
}

export type MapProjectionType = 'equalEarth' | 'naturalEarth' | 'mercator';
export type MapRegionType = 'world' | 'asia' | 'europe' | 'china' | 'japan' | 'arctic';

export interface MapConfig {
  projection: MapProjectionType;
  region: MapRegionType;
  landColor: string;
  borderColor: string;
  oceanColor: string;
}

export interface ProjectData {
  version: '1.0';
  title: string;
  places: Place[];
  routeStyle: RouteStyle;
  markerStyle: MarkerStyle;
  labelStyle: LabelStyle;
  mapConfig: MapConfig;
  updatedAt?: string;
}