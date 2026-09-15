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
      // True Polar Azimuthal Equidistant centered on North Pole
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

  // Base scale calculation
  const baseScale = width / 6.28;
  proj.translate([width / 2, height / 2]);

  // Adjust for region presets if specified
  if (basemap.projection === 'azimuthalEquidistant' || basemap.projection === 'stereographic') {
    // Polar view fits nicely from 50N to 90N
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
    return {
      zoom: 1.5,
      panX: (width / 2 - pt[0]),
      panY: (height / 2 - pt[1])
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

  const zoom = Math.min(Math.max(availWidth / ptsWidth, availHeight / ptsHeight), 12);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Screen center offset
  const panX = -(centerX - width / 2) * zoom;
  const panY = -(centerY - height / 2) * zoom;

  return {
    zoom: Math.min(Math.max(zoom, 0.5), 15),
    panX,
    panY
  };
}