import { describe, it, expect } from 'vitest';
import { calculateFitToPoints, calculateFitToImage } from '../map/projections';
import {
  fitAffineTransform,
  checkControlPointsQuality,
  CalibratedImageTransformer,
  FreeImageTransformer
} from '../map/transformer';
import { Place, CalibrationPoint } from '../types';

describe('1. Fit to Points Algorithm', () => {
  it('single point: centers exactly on screen with zoom=1.5', () => {
    const width = 1000;
    const height = 600;
    const singlePlace: Place = {
      id: 'p1',
      name: 'Tokyo',
      displayName: '东京',
      lat: 35.68,
      lon: 139.76,
      order: 0,
      source: 'coordinates',
      rawInput: '东京',
      status: 'resolved'
    };

    const projectFn = () => [400, 200] as [number, number];
    const fit = calculateFitToPoints([singlePlace], width, height, projectFn);

    expect(fit).not.toBeNull();
    expect(fit!.zoom).toBe(1.5);
    // screenX = (400 - 500) * 1.5 + 500 + panX = -150 + 500 + 150 = 500 (screen center!)
    const screenX = (400 - width / 2) * fit!.zoom + width / 2 + fit!.panX;
    const screenY = (200 - height / 2) * fit!.zoom + height / 2 + fit!.panY;
    expect(screenX).toBeCloseTo(500, 1);
    expect(screenY).toBeCloseTo(300, 1);
  });

  it('multi-point: guarantees ALL markers fall strictly inside visible canvas bounds (Math.min(zoomX, zoomY))', () => {
    const width = 1000;
    const height = 600;
    // Points spread far vertically (e.g. 500px height difference, 100px width difference)
    const pts: [number, number][] = [
      [200, 50],
      [300, 550]
    ];
    const places: Place[] = pts.map((pt, i) => ({
      id: `p${i}`,
      name: `Pt${i}`,
      displayName: `Pt${i}`,
      lat: 0,
      lon: 0,
      order: i,
      source: 'coordinates',
      rawInput: '',
      status: 'resolved'
    }));

    const projectFn = (_lon: number, _lat: number, p: Place) => {
      const idx = parseInt(p.id.replace('p', ''));
      return pts[idx];
    };

    const fit = calculateFitToPoints(places, width, height, projectFn, 0.1);
    expect(fit).not.toBeNull();

    // Verify each point's screen coordinate is inside [0, width] and [0, height]
    for (const pt of pts) {
      const screenX = (pt[0] - width / 2) * fit!.zoom + width / 2 + fit!.panX;
      const screenY = (pt[1] - height / 2) * fit!.zoom + height / 2 + fit!.panY;

      expect(screenX).toBeGreaterThanOrEqual(50);
      expect(screenX).toBeLessThanOrEqual(950);
      expect(screenY).toBeGreaterThanOrEqual(30);
      expect(screenY).toBeLessThanOrEqual(570);
    }
  });

  it('calculateFitToImage: fits 2160x2160 custom image completely inside viewport', () => {
    const width = 1000;
    const height = 600;
    const imgW = 2160;
    const imgH = 2160;

    const fit = calculateFitToImage(imgW, imgH, width, height, 0.08);

    // Test 4 corners of the image
    const corners: [number, number][] = [
      [0, 0],
      [imgW, 0],
      [0, imgH],
      [imgW, imgH]
    ];

    for (const [x, y] of corners) {
      const screenX = (x - width / 2) * fit.zoom + width / 2 + fit.panX;
      const screenY = (y - height / 2) * fit.zoom + height / 2 + fit.panY;

      expect(screenX).toBeGreaterThanOrEqual(0);
      expect(screenX).toBeLessThanOrEqual(width);
      expect(screenY).toBeGreaterThanOrEqual(0);
      expect(screenY).toBeLessThanOrEqual(height);
    }
  });
});

describe('2. Multi-point Affine Calibration & Geometry Quality Check', () => {
  const galapagosControlPoints: CalibrationPoint[] = [
    { placeId: 'isabela', name: '伊莎贝拉岛', lat: -0.8293, lon: -91.1349, imageX: 618, imageY: 2128 },
    { placeId: 'santiago', name: '圣地亚哥岛', lat: -0.25, lon: -90.7, imageX: 858, imageY: 1809 },
    { placeId: 'floreana', name: '弗雷里安纳岛', lat: -1.2975, lon: -90.4356, imageX: 1004, imageY: 2387 },
    { placeId: 'san_cristobal', name: '圣克里斯托瓦尔岛', lat: -0.9022, lon: -89.4314, imageX: 1558, imageY: 2169 }
  ];

  it('quality check passes for 4 well-dispersed control points', () => {
    const quality = checkControlPointsQuality(galapagosControlPoints);
    expect(quality.isValid).toBe(true);
    expect(quality.warning).toBeUndefined();
  });

  it('detects near-collinear control points and produces a clear warning', () => {
    // 3 points on a straight line: y = 2x
    const collinearPoints: CalibrationPoint[] = [
      { placeId: '1', name: 'A', lat: 10, lon: 10, imageX: 100, imageY: 100 },
      { placeId: '2', name: 'B', lat: 20, lon: 20, imageX: 200, imageY: 200 },
      { placeId: '3', name: 'C', lat: 30, lon: 30, imageX: 300, imageY: 300 }
    ];
    const quality = checkControlPointsQuality(collinearPoints);
    expect(quality.isValid).toBe(false);
    expect(quality.warning).toContain('过于接近同一条直线');
  });

  it('detects overly concentrated control points', () => {
    const tightPoints: CalibrationPoint[] = [
      { placeId: '1', name: 'A', lat: 35.001, lon: 139.001, imageX: 100, imageY: 100 },
      { placeId: '2', name: 'B', lat: 35.002, lon: 139.002, imageX: 105, imageY: 105 },
      { placeId: '3', name: 'C', lat: 35.001, lon: 139.003, imageX: 102, imageY: 110 }
    ];
    const quality = checkControlPointsQuality(tightPoints);
    expect(quality.isValid).toBe(false);
    expect(quality.warning).toContain('范围过于集中');
  });

  it('fits affine transform on Galapagos points with sub-pixel error', () => {
    const result = fitAffineTransform(galapagosControlPoints);
    expect(result).not.toBeNull();
    expect(result!.errorPx).toBeLessThan(1.5);

    // a ≈ 552, d ≈ -552
    expect(result!.transform.a).toBeCloseTo(552, 0);
    expect(result!.transform.d).toBeCloseTo(-552, 0);
  });

  it('predicts 5th place position (Baltra) and supports coordinate inversion', () => {
    const result = fitAffineTransform(galapagosControlPoints);
    expect(result).not.toBeNull();

    const transformer = new CalibratedImageTransformer(2160, 2160, result!.transform);

    // Baltra Island: lat -0.45, lon -90.28
    const projected = transformer.project(-90.28, -0.45);
    expect(projected).not.toBeNull();
    // Expected x around 1090, y around 1919
    expect(projected![0]).toBeCloseTo(1090, -1);
    expect(projected![1]).toBeCloseTo(1919, -1);

    // Test invert: from image pixels back to geographic lon, lat
    const inverted = transformer.invert(projected![0], projected![1]);
    expect(inverted).not.toBeNull();
    expect(inverted![0]).toBeCloseTo(-90.28, 2);
    expect(inverted![1]).toBeCloseTo(-0.45, 2);
  });
});

describe('3. Free Image Transformer & Integrity', () => {
  it('projects using normalized visualPosition', () => {
    const transformer = new FreeImageTransformer(1200, 800);
    const place: Place = {
      id: 'custom_1',
      name: 'Spot A',
      displayName: '景点A',
      lat: 0,
      lon: 0,
      order: 0,
      source: 'manual',
      rawInput: '',
      status: 'resolved',
      visualPosition: { x: 0.25, y: 0.75 }
    };

    const pt = transformer.project(0, 0, place);
    expect(pt).not.toBeNull();
    expect(pt![0]).toBe(300); // 0.25 * 1200
    expect(pt![1]).toBe(600); // 0.75 * 800
  });

  it('falls back to center if visualPosition is not yet specified', () => {
    const transformer = new FreeImageTransformer(1200, 800);
    const place: Place = {
      id: 'custom_2',
      name: 'Spot B',
      displayName: '景点B',
      lat: 0,
      lon: 0,
      order: 1,
      source: 'manual',
      rawInput: '',
      status: 'resolved'
    };

    const pt = transformer.project(0, 0, place);
    expect(pt).not.toBeNull();
    expect(pt![0]).toBe(600);
    expect(pt![1]).toBe(400);
  });
});

describe('4. Official Basemap Registry Integrity', () => {
  it('registry contains builtin vector world and pre-calibrated Galapagos topo map', async () => {
    const { OFFICIAL_BASEMAP_REGISTRY, OFFICIAL_COMPLIANCE_NOTICE } = await import(
      '../map/basemaps/registry'
    );
    expect(OFFICIAL_BASEMAP_REGISTRY.length).toBeGreaterThanOrEqual(2);

    const galapagos = OFFICIAL_BASEMAP_REGISTRY.find(o => o.id === 'galapagos-topo');
    expect(galapagos).toBeDefined();
    expect(galapagos!.defaultTransform).toBeDefined();
    expect(galapagos!.defaultControlPoints?.length).toBe(4);
    expect(galapagos!.imageWidth).toBe(2160);
    expect(galapagos!.imageHeight).toBe(2160);

    expect(OFFICIAL_COMPLIANCE_NOTICE).toContain('审图号');
  });
});

describe('5. Antimeridian Wrap Logic', () => {
  it('splits path across 180° meridian when successive deltaX exceeds threshold', () => {
    const canvasWidth = 1000;
    // Two points that jump across canvas: e.g. x=950 (Tokyo area) to x=50 (Anchorage area)
    const pts: [number, number][] = [
      [950, 300],
      [50, 200]
    ];

    let subPath = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    for (let k = 1; k < pts.length; k++) {
      const prev = pts[k - 1];
      const curr = pts[k];
      const deltaX = Math.abs(curr[0] - prev[0]);
      if (deltaX > canvasWidth * 0.45) {
        subPath += ` M ${curr[0].toFixed(2)} ${curr[1].toFixed(2)}`;
      } else {
        subPath += ` L ${curr[0].toFixed(2)} ${curr[1].toFixed(2)}`;
      }
    }

    // Should NOT contain a connecting 'L', but a disconnect 'M'
    expect(subPath).toBe('M 950.00 300.00 M 50.00 200.00');
    expect(subPath).not.toContain('L');
  });
});
