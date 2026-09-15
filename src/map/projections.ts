import * as d3 from 'd3-geo';
import { BuiltinBasemap, Place } from '../types';

export interface ProjectionContext {
  projection: d3.GeoProjection;
  pathGenerator: d3.GeoPath;
  width: number;
  height: number;
}

/**
 * Creates and configures a D3 projection based on map configuration and viewport size
 */
export function createMapProjection(
  basemap: BuiltinBasemap,
  width: number,
  height: number
): ProjectionContext {
  let proj: d3.GeoProjection;

  switch (basemap.projection) {
    case 'equalEarth':
      proj = d3.geoEqualEarth();
      break;
    case 'naturalEarth':
      proj = d3.geoNaturalEarth1();
      break;
    case 'azimuthalEquidistant':
      proj = d3.geoAzimuthalEquidistant().rotate([0, -90]);
      break;
    case 'stereographic':
      proj = d3.geoStereographic().rotate([0, -90]);
      break;
    case 'mercator':
    default:
      proj = d3.geoMercator();
      break;
  }

  const baseScale = width / 6.28;
  proj.translate([width / 2, height / 2]);

  if (basemap.projection === 'azimuthalEquidistant' || basemap.projection === 'stereographic') {
    proj.scale(Math.min(width, height) * 0.75);
    proj.clipAngle(180 - 1e-4);
  } else {
    switch (basemap.region) {
      case 'asia':
        proj.center([95, 30]).scale(baseScale * 1.8);
        break;
      case 'europe':
        proj.center([15, 52]).scale(baseScale * 2.8);
        break;
      case 'china':
        proj.center([105, 35]).scale(baseScale * 3.5);
        break;
      case 'japan':
        proj.center([138, 38]).scale(baseScale * 7.5);
        break;
      case 'arctic':
        proj.center([0, 78]).scale(baseScale * 2.2);
        break;
      case 'world':
      default:
        proj.scale(Math.min(width / 6.2, height / 3.4));
        break;
    }
  }

  const pathGenerator = d3.geoPath().projection(proj);

  return {
    projection: proj,
    pathGenerator,
    width,
    height
  };
}

export interface FitResult {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Calculates optimal camera zoom and pan to fit all resolved places within viewport
 * Corrected formula: zoom = Math.min(zoomX, zoomY) to guarantee bounds fitting
 */
export function calculateFitToPoints(
  places: Place[],
  width: number,
  height: number,
  projectFn: (lon: number, lat: number, place: Place) => [number, number] | null,
  paddingRatio: number = 0.2
): FitResult | null {
  const validPoints: [number, number][] = [];

  for (const p of places) {
    if (p.status !== 'resolved') continue;
    const pt = projectFn(p.lon, p.lat, p);
    if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
      validPoints.push(pt);
    }
  }

  if (validPoints.length === 0) return null;

  if (validPoints.length === 1) {
    const pt = validPoints[0];
    const singleZoom = 1.5;
    return {
      zoom: singleZoom,
      panX: -(pt[0] - width / 2) * singleZoom,
      panY: -(pt[1] - height / 2) * singleZoom
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [x, y] of validPoints) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const ptsWidth = Math.max(maxX - minX, 40);
  const ptsHeight = Math.max(maxY - minY, 40);

  const availWidth = width * (1 - paddingRatio * 2);
  const availHeight = height * (1 - paddingRatio * 2);

  // Must use Math.min to ensure BOTH width and height fit into viewport
  const zoomX = availWidth / ptsWidth;
  const zoomY = availHeight / ptsHeight;
  const zoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.4), 15);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const panX = -(centerX - width / 2) * zoom;
  const panY = -(centerY - height / 2) * zoom;

  return {
    zoom,
    panX,
    panY
  };
}

/**
 * Calculates optimal camera zoom and pan to fit an entire image within viewport
 */
export function calculateFitToImage(
  imageWidth: number,
  imageHeight: number,
  width: number,
  height: number,
  paddingRatio: number = 0.08
): FitResult {
  const availWidth = width * (1 - paddingRatio * 2);
  const availHeight = height * (1 - paddingRatio * 2);

  const zoomX = availWidth / imageWidth;
  const zoomY = availHeight / imageHeight;
  const zoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.1), 10);

  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;

  const panX = -(centerX - width / 2) * zoom;
  const panY = -(centerY - height / 2) * zoom;

  return { zoom, panX, panY };
}