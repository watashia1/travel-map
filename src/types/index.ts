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
  
  // Custom manual visual offsets (screen pixels)
  manualOffsetX?: number;
  manualOffsetY?: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
  
  // Normalized 0~1 coordinate for free-image basemaps
  visualPosition?: {
    x: number; // 0 to 1 relative to image width
    y: number; // 0 to 1 relative to image height
  };

  // Visibility toggle
  hideMarker?: boolean;
  hideLabel?: boolean;
}

export type RouteType = 'curved' | 'straight';
export type RouteMode = 'geodesic' | 'straight-screen' | 'decorative-curve';
export type DashStyle = 'solid' | 'dashed' | 'dotted';

export interface RouteStyle {
  type: RouteType;
  mode: RouteMode;
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
  autoAvoidCollisions: boolean;
}

export type MapProjectionType =
  | 'equalEarth'
  | 'naturalEarth'
  | 'mercator'
  | 'azimuthalEquidistant'
  | 'stereographic';

export type MapRegionType = 'world' | 'asia' | 'europe' | 'china' | 'japan' | 'arctic';

export interface BuiltinBasemap {
  type: 'builtin';
  mapId: string;
  projection: MapProjectionType;
  region: MapRegionType;
  landColor: string;
  borderColor: string;
  oceanColor: string;
}

export interface FreeImageBasemap {
  type: 'free-image';
  assetId: string;
  imageName?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageUrl?: string; // Loaded blob or data url
}

export interface EquirectangularImageBasemap {
  type: 'equirectangular-image';
  assetId: string;
  imageName?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageUrl?: string;
}

export interface CalibrationPoint {
  placeId: string;
  name: string;
  lat: number;
  lon: number;
  imageX: number; // pixel coordinate
  imageY: number;
}

export interface CalibrationTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export interface CalibratedImageBasemap {
  type: 'calibrated-image';
  assetId: string;
  imageName?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageUrl?: string;
  controlPoints: CalibrationPoint[];
  transform?: CalibrationTransform;
  errorPx?: number;
}

export type BasemapConfig =
  | BuiltinBasemap
  | FreeImageBasemap
  | EquirectangularImageBasemap
  | CalibratedImageBasemap;

export interface CameraState {
  zoom: number;
  panX: number;
  panY: number;
  autoFit?: boolean;
}

export type OverlayScaleMode = 'screen-fixed' | 'map-scaled';

export interface ProjectData {
  version: '2.0';
  title: string;
  places: Place[];
  basemap: BasemapConfig;
  camera: CameraState;
  routeStyle: RouteStyle;
  markerStyle: MarkerStyle;
  labelStyle: LabelStyle;
  overlayScaleMode: OverlayScaleMode;
  updatedAt?: string;
}