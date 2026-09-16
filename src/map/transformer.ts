import * as d3 from 'd3-geo';
import {
  Place,
  BasemapConfig,
  CalibrationPoint,
  CalibrationTransform,
  FreeImageBasemap,
  EquirectangularImageBasemap,
  CalibratedImageBasemap,
} from '../types';

export type ImageBasemapConfig =
  | FreeImageBasemap
  | EquirectangularImageBasemap
  | CalibratedImageBasemap;

export interface CoordinateTransformer {
  type: string;
  project(lon: number, lat: number, place?: Place): [number, number] | null;
  invert?(screenX: number, screenY: number): [number, number] | null;
  bounds?: { width: number; height: number };
}

/**
 * Unified place anchor in map coordinates (map-space / image pixels).
 * Used by MarkerLayer, RouteLayer, LabelLayer, leader lines, and bounds fitting.
 * Guarantees zero drift under zoom and pan!
 */
export function getPlaceMapAnchor(
  place: Place,
  transformer: CoordinateTransformer
): [number, number] | null {
  const pt = transformer.project(place.lon, place.lat, place);
  if (!pt) return null;

  const offX = place.markerMapOffsetX ?? place.manualOffsetX ?? 0;
  const offY = place.markerMapOffsetY ?? place.manualOffsetY ?? 0;

  return [pt[0] + offX, pt[1] + offY];
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
 * Checks geometric distribution quality of calibration points
 */
export function checkControlPointsQuality(points: CalibrationPoint[]): {
  isValid: boolean;
  warning?: string;
} {
  if (points.length < 3) {
    return { isValid: false, warning: '至少需要 3 个控制点。' };
  }

  const lons = points.map(p => p.lon);
  const lats = points.map(p => p.lat);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);

  if (maxLon - minLon < 0.05 || maxLat - minLat < 0.05) {
    return {
      isValid: false,
      warning: '控制点范围过于集中，无法稳定求解仿射变换。请在地图更大跨度范围内标定。'
    };
  }

  // Check collinearity via triangle areas
  let maxTriangleArea = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      for (let k = j + 1; k < points.length; k++) {
        const p1 = points[i], p2 = points[j], p3 = points[k];
        const area = Math.abs(
          (p2.lon - p1.lon) * (p3.lat - p1.lat) - (p3.lon - p1.lon) * (p2.lat - p1.lat)
        );
        if (area > maxTriangleArea) maxTriangleArea = area;
      }
    }
  }

  if (maxTriangleArea < 0.005) {
    return {
      isValid: false,
      warning: '控制点分布过于接近同一条直线，无法稳定拟合二维仿射变换。请选择分散在东、西、南、北不同方位的地点。'
    };
  }

  return { isValid: true };
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

  // Compute Root Mean Square Error (RMSE) in pixels
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
  private transform: CalibrationTransform;

  constructor(
    arg1: CalibrationTransform | number,
    _arg2?: number,
    arg3?: CalibrationTransform
  ) {
    if (typeof arg1 === 'object' && arg1 !== null) {
      this.transform = arg1;
    } else if (arg3) {
      this.transform = arg3;
    } else {
      this.transform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    }
  }

  project(lon: number, lat: number): [number, number] | null {
    const { a, b, c, d, tx, ty } = this.transform;
    const x = a * lon + b * lat + tx;
    const y = c * lon + d * lat + ty;
    if (isNaN(x) || isNaN(y)) return null;
    return [x, y];
  }

  invert(x: number, y: number): [number, number] | null {
    const { a, b, c, d, tx, ty } = this.transform;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-10) return null;

    const dx = x - tx;
    const dy = y - ty;
    const lon = (d * dx - b * dy) / det;
    const lat = (-c * dx + a * dy) / det;
    return [lon, lat];
  }
}

/**
 * Safe transformer for an uploaded image that is still waiting for enough
 * calibration points. This is an expected editing state, not an error.
 */
export class PendingCalibrationTransformer implements CoordinateTransformer {
  type = 'calibrated-image-pending';

  project(): [number, number] | null {
    return null;
  }

  invert(): [number, number] | null {
    return null;
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
    if (!place?.visualPosition) return null;

    return [
      place.visualPosition.x * this.imageWidth,
      place.visualPosition.y * this.imageHeight
    ];
  }

  invert(screenX: number, screenY: number): [number, number] | null {
    return [screenX / this.imageWidth, screenY / this.imageHeight];
  }
}

/**
 * Image-only transformer factory. Keeping this separate from D3 projections
 * prevents image editing states from falling through to a null projection.
 */
export function createImageCoordinateTransformer(
  basemap: ImageBasemapConfig,
  canvasWidth: number,
  canvasHeight: number
): CoordinateTransformer {
  const width = basemap.imageWidth || canvasWidth;
  const height = basemap.imageHeight || canvasHeight;

  switch (basemap.type) {
    case 'free-image':
      return new FreeImageTransformer(width, height);
    case 'equirectangular-image':
      return new EquirectangularImageTransformer(width, height);
    case 'calibrated-image':
      return basemap.transform
        ? new CalibratedImageTransformer(basemap.transform)
        : new PendingCalibrationTransformer();
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
    return createImageCoordinateTransformer(basemap, canvasWidth, canvasHeight);
  }

  if (basemap.type === 'calibrated-image') {
    return createImageCoordinateTransformer(basemap, canvasWidth, canvasHeight);
  }

  if (basemap.type === 'free-image') {
    return createImageCoordinateTransformer(basemap, canvasWidth, canvasHeight);
  }

  return new D3ProjectionTransformer(d3Proj);
}
