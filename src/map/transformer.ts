import * as d3 from 'd3-geo';
import { Place, BasemapConfig, CalibrationPoint, CalibrationTransform } from '../types';

export interface CoordinateTransformer {
  type: string;
  project(lon: number, lat: number, place?: Place): [number, number] | null;
  invert?(screenX: number, screenY: number): [number, number] | null;
  bounds?: { width: number; height: number };
}

/**
 * Transformer for D3 Geo Projections (Builtin Basemaps)
 */
export class D3ProjectionTransformer implements CoordinateTransformer {
  type = 'd3-projection';
  constructor(private projection: d3.GeoProjection) {}

  project(lon: number, lat: number): [number, number] | null {
    const pt = this.projection([lon, lat]);
    if (!pt || isNaN(pt[0]) || isNaN(pt[1])) return null;
    return [pt[0], pt[1]];
  }

  invert(screenX: number, screenY: number): [number, number] | null {
    if (!this.projection.invert) return null;
    const pt = this.projection.invert([screenX, screenY]);
    if (!pt || isNaN(pt[0]) || isNaN(pt[1])) return null;
    return [pt[0], pt[1]];
  }
}

/**
 * Transformer for Standard Equirectangular World Image
 * X: -180 to +180, Y: -90 to +90
 */
export class EquirectangularImageTransformer implements CoordinateTransformer {
  type = 'equirectangular-image';
  constructor(private imageWidth: number, private imageHeight: number) {}

  project(lon: number, lat: number): [number, number] | null {
    // Normalization to image coordinates
    const normX = (lon + 180) / 360;
    const normY = (90 - lat) / 180;
    return [normX * this.imageWidth, normY * this.imageHeight];
  }

  invert(x: number, y: number): [number, number] | null {
    const lon = (x / this.imageWidth) * 360 - 180;
    const lat = 90 - (y / this.imageHeight) * 180;
    return [lon, lat];
  }
}

/**
 * Solves 2D affine transform using Least Squares Fitting
 * x_img = a * lon + b * lat + tx
 * y_img = c * lon + d * lat + ty
 */
export function fitAffineTransform(points: CalibrationPoint[]): {
  transform: CalibrationTransform;
  errorPx: number;
} | null {
  if (points.length < 3) return null;

  const n = points.length;
  let sumLon = 0, sumLat = 0, sumLon2 = 0, sumLat2 = 0, sumLonLat = 0;
  let sumX = 0, sumY = 0, sumLonX = 0, sumLatX = 0, sumLonY = 0, sumLatY = 0;

  for (const p of points) {
    const { lon, lat, imageX, imageY } = p;
    sumLon += lon;
    sumLat += lat;
    sumLon2 += lon * lon;
    sumLat2 += lat * lat;
    sumLonLat += lon * lat;

    sumX += imageX;
    sumY += imageY;
    sumLonX += lon * imageX;
    sumLatX += lat * imageX;
    sumLonY += lon * imageY;
    sumLatY += lat * imageY;
  }

  // Linear system matrix: [ [sumLon2, sumLonLat, sumLon], [sumLonLat, sumLat2, sumLat], [sumLon, sumLat, n] ]
  // We can solve using Gaussian elimination or Cramer's rule for 3x3
  function solve3x3(A: number[][], B: number[]): [number, number, number] | null {
    const det =
      A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
      A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
      A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);

    if (Math.abs(det) < 1e-10) return null;

    function det3(M: number[][]): number {
      return (
        M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
        M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
        M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
      );
    }

    const mX = [
      [B[0], A[0][1], A[0][2]],
      [B[1], A[1][1], A[1][2]],
      [B[2], A[2][1], A[2][2]]
    ];
    const mY = [
      [A[0][0], B[0], A[0][2]],
      [A[1][0], B[1], A[1][2]],
      [A[2][0], B[2], A[2][2]]
    ];
    const mZ = [
      [A[0][0], A[0][1], B[0]],
      [A[1][0], A[1][1], B[1]],
      [A[2][0], A[2][1], B[2]]
    ];

    return [det3(mX) / det, det3(mY) / det, det3(mZ) / det];
  }

  const matA = [
    [sumLon2, sumLonLat, sumLon],
    [sumLonLat, sumLat2, sumLat],
    [sumLon, sumLat, n]
  ];

  const solX = solve3x3(matA, [sumLonX, sumLatX, sumX]);
  const solY = solve3x3(matA, [sumLonY, sumLatY, sumY]);

  if (!solX || !solY) return null;

  const [a, b, tx] = solX;
  const [c, d, ty] = solY;

  // Calculate Mean Square Error (RMSE in pixels)
  let totalErrorSq = 0;
  for (const p of points) {
    const estX = a * p.lon + b * p.lat + tx;
    const estY = c * p.lon + d * p.lat + ty;
    const errX = estX - p.imageX;
    const errY = estY - p.imageY;
    totalErrorSq += errX * errX + errY * errY;
  }
  const errorPx = Math.sqrt(totalErrorSq / n);

  return {
    transform: { a, b, c, d, tx, ty },
    errorPx: Math.round(errorPx * 10) / 10
  };
}

/**
 * Transformer for Calibrated Maps
 */
export class CalibratedImageTransformer implements CoordinateTransformer {
  type = 'calibrated-image';
  constructor(private transform: CalibrationTransform) {}

  project(lon: number, lat: number): [number, number] | null {
    const { a, b, c, d, tx, ty } = this.transform;
    const x = a * lon + b * lat + tx;
    const y = c * lon + d * lat + ty;
    if (isNaN(x) || isNaN(y)) return null;
    return [x, y];
  }
}

/**
 * Transformer for Free Image Basemap
 * Directly uses place.visualPosition (0~1 normalized coordinate)
 */
export class FreeImageTransformer implements CoordinateTransformer {
  type = 'free-image';
  constructor(private imageWidth: number, private imageHeight: number) {}

  project(_lon: number, _lat: number, place?: Place): [number, number] | null {
    if (place?.visualPosition) {
      return [
        place.visualPosition.x * this.imageWidth,
        place.visualPosition.y * this.imageHeight
      ];
    }
    // Fallback: place in middle area
    return [this.imageWidth / 2, this.imageHeight / 2];
  }

  invert(screenX: number, screenY: number): [number, number] | null {
    return [screenX / this.imageWidth, screenY / this.imageHeight];
  }
}

/**
 * Factory that creates the appropriate CoordinateTransformer based on basemap configuration
 */
export function createCoordinateTransformer(
  basemap: BasemapConfig,
  d3Proj: d3.GeoProjection,
  canvasWidth: number,
  canvasHeight: number
): CoordinateTransformer {
  if (basemap.type === 'builtin') {
    return new D3ProjectionTransformer(d3Proj);
  }

  if (basemap.type === 'equirectangular-image') {
    const w = basemap.imageWidth || canvasWidth;
    const h = basemap.imageHeight || canvasHeight;
    return new EquirectangularImageTransformer(w, h);
  }

  if (basemap.type === 'calibrated-image' && basemap.transform) {
    return new CalibratedImageTransformer(basemap.transform);
  }

  if (basemap.type === 'free-image') {
    const w = basemap.imageWidth || canvasWidth;
    const h = basemap.imageHeight || canvasHeight;
    return new FreeImageTransformer(w, h);
  }

  // Fallback to D3
  return new D3ProjectionTransformer(d3Proj);
}