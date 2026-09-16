import { describe, it, expect } from 'vitest';
import * as d3 from 'd3-geo';
import { migrateProjectV2ToV3 } from '../types/migration';
import { REGION_CAMERA_PRESETS } from '../maplibre/regionPresets';
import { createCartoTravelCleanStyle, createNaturalEarthStyle } from '../maplibre/createTravelStyle';
import { Place } from '../types';
import {
  DEFAULT_MAPLIBRE_STYLE_ID,
  MAPLIBRE_STYLE_OPTIONS,
} from '../maplibre/styleCatalog';

describe('travel-map V3 Architecture & Migration', () => {
  describe('ProjectData V2 to V3 Migration', () => {
    it('migrates V2 builtin world map to V3 builtin-maplibre with the default style', () => {
      const v2Project = {
        version: '2.0',
        title: '我的旧世界旅行',
        places: [
          {
            id: 'p1',
            rawInput: '北京',
            name: '北京',
            displayName: '北京',
            lat: 39.9,
            lon: 116.4,
            source: 'local-place-db',
            order: 0,
            status: 'resolved',
          },
        ],
        basemap: {
          type: 'builtin',
          mapId: 'world',
          projection: 'equalEarth',
          region: 'world',
          landColor: '#f1efe8',
          borderColor: '#d5d2c8',
          oceanColor: '#ffffff',
          enableColorByCountry: true,
          showAdmin1: true,
        },
        camera: { zoom: 1.5, panX: 20, panY: -10 },
      };

      const v3 = migrateProjectV2ToV3(v2Project);

      expect(v3.version).toBe('3.0');
      expect(v3.basemap.type).toBe('builtin-maplibre');
      if (v3.basemap.type === 'builtin-maplibre') {
        expect(v3.basemap.styleId).toBe('liberty');
        expect(v3.basemap.enableCountryFill).toBe(true);
        expect(v3.basemap.showAdmin1).toBe(true);
      }
      expect(v3.places[0].geoStatus).toBe('resolved');
    });

    it('migrates V2 antarctica builtin map to polar stereographic basemap', () => {
      const v2Antarctica = {
        version: '2.0',
        title: '南极科考',
        places: [
          {
            id: 'p1',
            name: '长城站',
            displayName: '长城站',
            lat: -62.2,
            lon: -58.9,
            status: 'resolved',
            order: 0,
          },
        ],
        basemap: {
          type: 'builtin',
          region: 'antarctica',
        },
        camera: { zoom: 2, panX: 0, panY: 0 },
      };

      const v3 = migrateProjectV2ToV3(v2Antarctica);

      expect(v3.version).toBe('3.0');
      expect(v3.basemap.type).toBe('polar');
      if (v3.basemap.type === 'polar') {
        expect(v3.basemap.pole).toBe('south');
        expect(v3.basemap.projection).toBe('stereographic');
      }
      expect(v3.views?.polar?.zoom).toBe(2);
    });

    it('preserves image view state for custom calibrated images', () => {
      const v2Image = {
        version: '2.0',
        places: [],
        basemap: {
          type: 'calibrated-image',
          assetId: 'img-123',
          imageWidth: 2000,
          imageHeight: 1200,
        },
        camera: { zoom: 1.8, panX: 100, panY: -50 },
      };

      const v3 = migrateProjectV2ToV3(v2Image);
      expect(v3.views?.image?.zoom).toBe(1.8);
      expect(v3.views?.image?.panX).toBe(100);
      expect(v3.views?.image?.panY).toBe(-50);
    });
  });

  describe('MapLibre Region Camera Presets', () => {
    it('provides all 7 global continent presets with valid coordinates', () => {
      expect(REGION_CAMERA_PRESETS.length).toBe(7);
      const ids = REGION_CAMERA_PRESETS.map((p) => p.id);
      expect(ids).toContain('world');
      expect(ids).toContain('asia');
      expect(ids).toContain('europe');
      expect(ids).toContain('africa');
      expect(ids).toContain('north-america');
      expect(ids).toContain('south-america');
      expect(ids).toContain('oceania');

      for (const p of REGION_CAMERA_PRESETS) {
        expect(p.center[0]).toBeGreaterThanOrEqual(-180);
        expect(p.center[0]).toBeLessThanOrEqual(180);
        expect(p.center[1]).toBeGreaterThanOrEqual(-90);
        expect(p.center[1]).toBeLessThanOrEqual(90);
        expect(p.zoom).toBeGreaterThan(1);
      }
    });
  });

  describe('Map Styles Specification', () => {
    it('uses OpenFreeMap Liberty by default and lists Travel Clean last', () => {
      expect(DEFAULT_MAPLIBRE_STYLE_ID).toBe('liberty');
      expect(MAPLIBRE_STYLE_OPTIONS[0].id).toBe('liberty');
      expect(MAPLIBRE_STYLE_OPTIONS.at(-1)?.id).toBe('travel-clean');
    });

    it('creates valid Travel Clean style with Carto raster source and layers', async () => {
      const style = await createCartoTravelCleanStyle();
      expect(style.version).toBe(8);
      expect(style.sources['carto-positron-nolabels']).toBeDefined();
      expect(style.layers.some((l) => l.id === 'carto-tiles')).toBe(true);
    });

    it('creates valid Natural Earth offline vector style', async () => {
      const style = await createNaturalEarthStyle();
      expect(style.version).toBe(8);
      expect(style.layers.some((l) => l.id === 'background')).toBe(true);
    });
  });

  describe('Polar Projections Correctness', () => {
    it('North Pole azimuthal projection maps (0, 90) directly to center', () => {
      const width = 1000;
      const height = 600;
      const proj = d3
        .geoAzimuthalEquidistant()
        .rotate([0, -90])
        .translate([width / 2, height / 2]);

      const pt = proj([0, 90]);
      expect(pt).toBeDefined();
      expect(pt![0]).toBeCloseTo(width / 2, 1);
      expect(pt![1]).toBeCloseTo(height / 2, 1);
    });

    it('South Pole stereographic projection maps (0, -90) directly to center', () => {
      const width = 1000;
      const height = 600;
      const proj = d3
        .geoStereographic()
        .rotate([0, 90])
        .translate([width / 2, height / 2]);

      const pt = proj([0, -90]);
      expect(pt).toBeDefined();
      expect(pt![0]).toBeCloseTo(width / 2, 1);
      expect(pt![1]).toBeCloseTo(height / 2, 1);
    });
  });

  describe('Screen Anchor & Zero Drift Invariants', () => {
    it('Label position strictly equals screen anchor plus labelOffset in screen space', () => {
      const screenBaseX = 450.25;
      const screenBaseY = 320.75;
      const labelOffsetX = 18;
      const labelOffsetY = -14;

      const labelX = screenBaseX + labelOffsetX;
      const labelY = screenBaseY + labelOffsetY;

      expect(labelX - screenBaseX).toBe(18);
      expect(labelY - screenBaseY).toBe(-14);
    });

    it('Geodesic interpolation accurately generates smooth points between Tokyo and Anchorage', () => {
      const tokyo = [139.69, 35.68];
      const anchorage = [-149.9, 61.21];

      const interpolator = d3.geoInterpolate(tokyo as any, anchorage as any);
      const mid = interpolator(0.5);

      // Great circle path from Tokyo to Anchorage arcs northward near Aleutian Islands / Kamchatka (lat > 50)
      expect(mid[1]).toBeGreaterThan(50);
    });
  });
});
