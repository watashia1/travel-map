import * as d3 from 'd3-geo';
import { MapConfig } from '../types';

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
  config: MapConfig,
  width: number,
  height: number
): ProjectionContext {
  let proj: d3.GeoProjection;

  switch (config.projection) {
    case 'equalEarth':
      proj = d3.geoEqualEarth();
      break;
    case 'naturalEarth':
      proj = d3.geoNaturalEarth1();
      break;
    case 'mercator':
    default:
      proj = d3.geoMercator();
      break;
  }

  // Base setup
  const baseScale = width / 6.28; // Default fit for world width
  proj.translate([width / 2, height / 2]);

  switch (config.region) {
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
      // Rotate to view Arctic clearly from north
      proj.center([0, 78]).scale(baseScale * 2.2);
      break;
    case 'world':
    default:
      // Fit whole world nicely
      proj.scale(Math.min(width / 6.2, height / 3.4));
      break;
  }

  const pathGenerator = d3.geoPath().projection(proj);

  return {
    projection: proj,
    pathGenerator,
    width,
    height
  };
}