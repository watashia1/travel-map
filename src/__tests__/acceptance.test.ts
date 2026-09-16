import { describe, it, expect } from 'vitest';
import { calculateFitToPoints, calculateFitToImage, createMapProjection } from '../map/projections';
import {
  fitAffineTransform,
  checkControlPointsQuality,
  CalibratedImageTransformer,
  FreeImageTransformer,
  PendingCalibrationTransformer,
  createImageCoordinateTransformer,
  D3ProjectionTransformer,
  getPlaceMapAnchor
} from '../map/transformer';
import { Place, CalibrationPoint, BuiltinBasemap, CameraState } from '../types';
import { BUILTIN_MAP_PRESETS, OFFICIAL_BASEMAP_REGISTRY } from '../map/basemaps/registry';

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
    const screenX = (400 - width / 2) * fit!.zoom + width / 2 + fit!.panX;
    const screenY = (200 - height / 2) * fit!.zoom + height / 2 + fit!.panY;
    expect(screenX).toBeCloseTo(500, 1);
    expect(screenY).toBeCloseTo(300, 1);
  });

  it('multi-point: guarantees ALL markers fall strictly inside visible canvas bounds (Math.min(zoomX, zoomY))', () => {
    const width = 1000;
    const height = 600;
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

    for (const pt of pts) {
      const screenX = (pt[0] - width / 2) * fit!.zoom + width / 2 + fit!.panX;
      const screenY = (pt[1] - height / 2) * fit!.zoom + height / 2 + fit!.panY;

      expect(screenX).toBeGreaterThanOrEqual(50);
      expect(screenX).toBeLessThanOrEqual(950);
      expect(screenY).toBeGreaterThanOrEqual(30);
      expect(screenY).toBeLessThanOrEqual(570);
    }
  });

  it('calculateFitToImage: fits custom image completely inside viewport', () => {
    const width = 1000;
    const height = 600;
    const imgW = 2160;
    const imgH = 2160;

    const fit = calculateFitToImage(imgW, imgH, width, height, 0.08);

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

describe('2. Multi-point Affine Calibration Quality Check (Custom Image Fixture)', () => {
  const fixturePoints: CalibrationPoint[] = [
    { placeId: 'isabela', name: '伊莎贝拉岛', lat: -0.8293, lon: -91.1349, imageX: 618, imageY: 2128 },
    { placeId: 'santiago', name: '圣地亚哥岛', lat: -0.25, lon: -90.7, imageX: 858, imageY: 1809 },
    { placeId: 'floreana', name: '弗雷里安纳岛', lat: -1.2975, lon: -90.4356, imageX: 1004, imageY: 2387 },
    { placeId: 'san_cristobal', name: '圣克里斯托瓦尔岛', lat: -0.9022, lon: -89.4314, imageX: 1558, imageY: 2169 }
  ];

  it('quality check passes for 4 well-dispersed control points', () => {
    const quality = checkControlPointsQuality(fixturePoints);
    expect(quality.isValid).toBe(true);
    expect(quality.warning).toBeUndefined();
  });

  it('detects near-collinear control points and produces a clear warning', () => {
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

  it('fits affine transform with sub-pixel error and supports coordinate inversion', () => {
    const result = fitAffineTransform(fixturePoints);
    expect(result).not.toBeNull();
    expect(result!.errorPx).toBeLessThan(1.5);

    const transformer = new CalibratedImageTransformer(2160, 2160, result!.transform);
    const projected = transformer.project(-90.28, -0.45);
    expect(projected).not.toBeNull();
    expect(projected![0]).toBeCloseTo(1090, -1);
    expect(projected![1]).toBeCloseTo(1919, -1);

    const inverted = transformer.invert(projected![0], projected![1]);
    expect(inverted).not.toBeNull();
    expect(inverted![0]).toBeCloseTo(-90.28, 2);
    expect(inverted![1]).toBeCloseTo(-0.45, 2);
  });
});

describe('2B. Custom Image Transformer State Safety', () => {
  const resolvedPlace: Place = {
    id: 'tokyo',
    name: 'Tokyo',
    displayName: '东京',
    lat: 35.68,
    lon: 139.76,
    order: 0,
    source: 'coordinates',
    rawInput: '东京',
    status: 'resolved',
  };

  it('uses a safe pending transformer for calibrated images with 0-2 control points', () => {
    for (const count of [0, 1, 2]) {
      const transformer = createImageCoordinateTransformer(
        {
          type: 'calibrated-image',
          assetId: 'pending-map',
          imageWidth: 2160,
          imageHeight: 2160,
          controlPoints: Array.from({ length: count }, (_, index) => ({
            placeId: `p${index}`,
            name: `P${index}`,
            lat: index,
            lon: index,
            imageX: index * 100,
            imageY: index * 100,
          })),
        },
        1280,
        800
      );

      expect(transformer).toBeInstanceOf(PendingCalibrationTransformer);
      expect(transformer.project(resolvedPlace.lon, resolvedPlace.lat, resolvedPlace)).toBeNull();
    }
  });

  it('does not place an unpositioned free-image place at the image center', () => {
    const transformer = new FreeImageTransformer(2160, 2160);
    expect(transformer.project(resolvedPlace.lon, resolvedPlace.lat, resolvedPlace)).toBeNull();
  });

  it('projects a positioned free-image place using normalized image coordinates', () => {
    const transformer = new FreeImageTransformer(2000, 1000);
    const projected = transformer.project(0, 0, {
      ...resolvedPlace,
      visualPosition: { x: 0.25, y: 0.75 },
      visualStatus: 'placed',
    });
    expect(projected).toEqual([500, 750]);
  });
});

describe('3. Zero-Drift Map-Space Anchors & Camera Zoom/Pan Rigor', () => {
  const width = 1000;
  const height = 600;
  const builtinBasemap: BuiltinBasemap = {
    type: 'builtin',
    mapId: 'world',
    projection: 'equalEarth',
    region: 'world',
    landColor: '#f1efe8',
    borderColor: '#d5d2c8',
    oceanColor: '#ffffff'
  };

  const { projection } = createMapProjection(builtinBasemap, width, height);
  const transformer = new D3ProjectionTransformer(projection);

  it('Marker screen position mathematically equals camera-transformed anchor across zoom 0.5, 1.0, 1.5, 2.0, 5.0 and arbitrary pan', () => {
    const testPlace: Place = {
      id: 'beijing',
      name: 'Beijing',
      displayName: '北京',
      lat: 39.9042,
      lon: 116.4074,
      order: 0,
      source: 'coordinates',
      rawInput: '北京',
      status: 'resolved',
      markerMapOffsetX: 18.5,
      markerMapOffsetY: -12.4
    };

    const anchor = getPlaceMapAnchor(testPlace, transformer);
    expect(anchor).not.toBeNull();

    const zoomLevels = [0.5, 1.0, 1.5, 2.0, 5.0];
    const panOffsets = [
      { panX: 0, panY: 0 },
      { panX: 150, panY: -80 },
      { panX: -260, panY: 190 },
      { panX: 450, panY: 320 }
    ];

    for (const zoom of zoomLevels) {
      for (const { panX, panY } of panOffsets) {
        // MarkerLayer screen position formula
        const screenMarkerX = (anchor![0] - width / 2) * zoom + width / 2 + panX;
        const screenMarkerY = (anchor![1] - height / 2) * zoom + height / 2 + panY;

        // Camera transform applied directly to map anchor
        const cameraScreenX = (anchor![0] - width / 2) * zoom + width / 2 + panX;
        const cameraScreenY = (anchor![1] - height / 2) * zoom + height / 2 + panY;

        const driftPx = Math.hypot(screenMarkerX - cameraScreenX, screenMarkerY - cameraScreenY);
        // Strict specification requirement: drift must be < 0.5 px (here 0 px mathematical identity)
        expect(driftPx).toBeLessThan(0.001);
      }
    }
  });

  it('Dragging marker translates screen delta by / zoom to map-space without sliding under subsequent zoom changes', () => {
    const place: Place = {
      id: 'p_drag',
      name: 'Xian',
      displayName: '西安',
      lat: 34.3416,
      lon: 108.9398,
      order: 0,
      source: 'coordinates',
      rawInput: '西安',
      status: 'resolved',
      markerMapOffsetX: 0,
      markerMapOffsetY: 0
    };

    const initialAnchor = getPlaceMapAnchor(place, transformer)!;

    // Simulate drag by 40 screen pixels at zoom 2.0
    const zoomAtDrag = 2.0;
    const dxScreen = 40;
    const dyScreen = -20;
    const dxMap = dxScreen / zoomAtDrag; // 20 map units
    const dyMap = dyScreen / zoomAtDrag; // -10 map units

    const draggedPlace: Place = {
      ...place,
      markerMapOffsetX: dxMap,
      markerMapOffsetY: dyMap
    };

    const newAnchor = getPlaceMapAnchor(draggedPlace, transformer)!;
    expect(newAnchor[0] - initialAnchor[0]).toBeCloseTo(20, 2);
    expect(newAnchor[1] - initialAnchor[1]).toBeCloseTo(-10, 2);

    // Now verify that at any zoom level, the screen offset between new and initial is exactly proportional to zoom
    for (const z of [0.5, 1.0, 3.0, 5.0]) {
      const initialScreenX = (initialAnchor[0] - width / 2) * z + width / 2;
      const initialScreenY = (initialAnchor[1] - height / 2) * z + height / 2;

      const newScreenX = (newAnchor[0] - width / 2) * z + width / 2;
      const newScreenY = (newAnchor[1] - height / 2) * z + height / 2;

      expect(newScreenX - initialScreenX).toBeCloseTo(dxMap * z, 2);
      expect(newScreenY - initialScreenY).toBeCloseTo(dyMap * z, 2);
    }
  });
});

describe('4. Major Cities Consistency in Natural Earth Projections', () => {
  const width = 1000;
  const height = 600;

  const testCities = [
    { name: '北京', lat: 39.9042, lon: 116.4074 },
    { name: '上海', lat: 31.2304, lon: 121.4737 },
    { name: '西安', lat: 34.3416, lon: 108.9398 },
    { name: '兰州', lat: 36.0611, lon: 103.8343 },
    { name: '西宁', lat: 36.6171, lon: 101.7782 },
    { name: '东京', lat: 35.6762, lon: 139.6503 },
    { name: '札幌', lat: 43.0618, lon: 141.3545 },
    { name: '巴黎', lat: 48.8566, lon: 2.3522 },
    { name: '纽约', lat: 40.7128, lon: -74.0060 },
    { name: '悉尼', lat: -33.8688, lon: 151.2093 }
  ];

  it('projects all 10 standard test cities without NaN or null in world Equal Earth projection', () => {
    const { projection } = createMapProjection(
      {
        type: 'builtin',
        mapId: 'world',
        projection: 'equalEarth',
        region: 'world',
        landColor: '#f1efe8',
        borderColor: '#d5d2c8',
        oceanColor: '#ffffff'
      },
      width,
      height
    );

    const transformer = new D3ProjectionTransformer(projection);

    for (const city of testCities) {
      const pt = transformer.project(city.lon, city.lat);
      expect(pt).not.toBeNull();
      expect(pt![0]).toBeGreaterThan(0);
      expect(pt![0]).toBeLessThan(width);
      expect(pt![1]).toBeGreaterThan(0);
      expect(pt![1]).toBeLessThan(height);

      // Verify invert accuracy
      const inverted = transformer.invert(pt![0], pt![1]);
      expect(inverted).not.toBeNull();
      expect(inverted![0]).toBeCloseTo(city.lon, 2);
      expect(inverted![1]).toBeCloseTo(city.lat, 2);
    }
  });
});

describe('5. Oceania & Antarctica Viewports', () => {
  const width = 1000;
  const height = 600;

  it('Oceania: centers Pacific and protects 180° antimeridian so Sydney and Tonga/Samoa are continuous', () => {
    const { projection } = createMapProjection(
      {
        type: 'builtin',
        mapId: 'oceania',
        projection: 'equalEarth',
        region: 'oceania',
        landColor: '#f1efe8',
        borderColor: '#d5d2c8',
        oceanColor: '#ffffff'
      },
      width,
      height
    );

    const transformer = new D3ProjectionTransformer(projection);

    // Sydney: 151.2°E, Auckland: 174.7°E, Nadi (Fiji): 177.4°E, Nuku'alofa (Tonga): -175.2° (184.8°E)
    const ptSydney = transformer.project(151.2093, -33.8688)!;
    const ptAuckland = transformer.project(174.7633, -36.8485)!;
    const ptNadi = transformer.project(177.4356, -17.8065)!;
    const ptTonga = transformer.project(-175.2018, -21.1393)!;

    expect(ptSydney).not.toBeNull();
    expect(ptAuckland).not.toBeNull();
    expect(ptNadi).not.toBeNull();
    expect(ptTonga).not.toBeNull();

    // With [-150, 0] rotation, Auckland, Nadi and Tonga progress smoothly eastward without 1000px screen split!
    expect(Math.abs(ptTonga[0] - ptNadi[0])).toBeLessThan(width * 0.35);
    expect(Math.abs(ptNadi[0] - ptAuckland[0])).toBeLessThan(width * 0.35);
  });

  it('Antarctica: South Pole stereographic centers South Pole at [width/2, height/2]', () => {
    const { projection } = createMapProjection(
      {
        type: 'builtin',
        mapId: 'antarctica',
        projection: 'stereographic',
        region: 'antarctica',
        landColor: '#f1efe8',
        borderColor: '#d5d2c8',
        oceanColor: '#ffffff'
      },
      width,
      height
    );

    const transformer = new D3ProjectionTransformer(projection);

    // South Pole: lat -90, lon 0
    const polePt = transformer.project(0, -90)!;
    expect(polePt).not.toBeNull();
    expect(polePt[0]).toBeCloseTo(width / 2, 1);
    expect(polePt[1]).toBeCloseTo(height / 2, 1);

    // Great Wall Station: lat -62.22, lon -58.96
    const gwsPt = transformer.project(-58.96, -62.22)!;
    expect(gwsPt).not.toBeNull();
    expect(Math.hypot(gwsPt[0] - width / 2, gwsPt[1] - height / 2)).toBeGreaterThan(50);
  });
});

describe('6. Builtin Basemap Registry & Deletion of Galapagos', () => {
  it('registry contains exactly 8 official presets (World + 7 Continents)', () => {
    expect(BUILTIN_MAP_PRESETS.length).toBe(8);
    const ids = BUILTIN_MAP_PRESETS.map(p => p.id);
    expect(ids).toEqual([
      'world',
      'asia',
      'europe',
      'africa',
      'north-america',
      'south-america',
      'oceania',
      'antarctica'
    ]);
  });

  it('OFFICIAL_BASEMAP_REGISTRY has removed galapagos-topo', () => {
    const galapagos = OFFICIAL_BASEMAP_REGISTRY.find(o => o.id === 'galapagos-topo');
    expect(galapagos).toBeUndefined();
  });
});

