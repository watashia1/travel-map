import type { StyleSpecification } from 'maplibre-gl';
import { MapLibreStyleId } from '../types';
import { fetchGeoJSON } from '../utils/assets';

// Pastel 7-color palette for country fills (clean, travel-guide aesthetic)
const COUNTRY_COLORS = [
  '#f0ebe3', // 0: warm cream
  '#e4ece8', // 1: soft sage
  '#e8ebf3', // 2: muted blue-grey
  '#f2e6e6', // 3: pale blush
  '#ebe4ee', // 4: soft lavender
  '#e2edea', // 5: light cyan-mint
  '#f5eee4', // 6: muted sand
];

/**
 * Creates 100% offline local vector style using bundled Natural Earth GeoJSON
 */
export async function createNaturalEarthStyle(options?: {
  showAdmin1?: boolean;
}): Promise<StyleSpecification> {
  let countriesGeo: any = null;
  let admin1Geo: any = null;

  try {
    countriesGeo = await fetchGeoJSON('data/ne_110m_admin_0_countries.geojson');
    if (options?.showAdmin1 !== false) {
      admin1Geo = await fetchGeoJSON('data/ne_50m_admin_1_states_provinces_lines.geojson').catch(() => null);
    }
  } catch (err) {
    console.warn('Failed to load local Natural Earth GeoJSON:', err);
  }

  const sources: Record<string, any> = {};
  const layers: any[] = [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#e0edf8', // Clean ocean blue
      },
    },
  ];

  if (countriesGeo) {
    sources['ne-countries'] = {
      type: 'geojson',
      data: countriesGeo,
    };

    layers.push({
      id: 'ne-country-fill',
      type: 'fill',
      source: 'ne-countries',
      paint: {
        'fill-color': [
          'match',
          ['%', ['to-number', ['get', 'MAPCOLOR7'], 0], 7],
          0, COUNTRY_COLORS[0],
          1, COUNTRY_COLORS[1],
          2, COUNTRY_COLORS[2],
          3, COUNTRY_COLORS[3],
          4, COUNTRY_COLORS[4],
          5, COUNTRY_COLORS[5],
          6, COUNTRY_COLORS[6],
          '#f1f3f5',
        ],
        'fill-opacity': 0.95,
      },
    });

    layers.push({
      id: 'country-borders',
      type: 'line',
      source: 'ne-countries',
      paint: {
        'line-color': '#cbd5e1',
        'line-width': 0.8,
      },
    });
  }

  if (admin1Geo && options?.showAdmin1 !== false) {
    sources['ne-admin1'] = {
      type: 'geojson',
      data: admin1Geo,
    };

    layers.push({
      id: 'admin1-borders',
      type: 'line',
      source: 'ne-admin1',
      paint: {
        'line-color': '#94a3b8',
        'line-width': 0.5,
        'line-opacity': 0.5,
        'line-dasharray': [2, 2],
      },
    });
  }

  return {
    version: 8,
    name: 'Natural Earth Offline Vector',
    sources,
    layers,
  };
}

/**
 * Creates Travel Clean Style (Carto Positron No-Labels raster tiles + optional Natural Earth country fill)
 * High-DPI, globally accessible via fast Anycast CDN (works in China and worldwide)
 */
export async function createCartoTravelCleanStyle(options?: {
  enableCountryFill?: boolean;
}): Promise<StyleSpecification> {
  const sources: Record<string, any> = {
    'carto-positron-nolabels': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
    },
  };

  const layers: any[] = [
    {
      id: 'carto-tiles',
      type: 'raster',
      source: 'carto-positron-nolabels',
      minzoom: 0,
      maxzoom: 20,
    },
  ];

  if (options?.enableCountryFill) {
    try {
      const countriesGeo = await fetchGeoJSON('data/ne_110m_admin_0_countries.geojson');
      if (countriesGeo) {
        sources['ne-countries'] = {
          type: 'geojson',
          data: countriesGeo,
        };

        layers.push({
          id: 'ne-country-fill-overlay',
          type: 'fill',
          source: 'ne-countries',
          paint: {
            'fill-color': [
              'match',
              ['%', ['to-number', ['get', 'MAPCOLOR7'], 0], 7],
              0, COUNTRY_COLORS[0],
              1, COUNTRY_COLORS[1],
              2, COUNTRY_COLORS[2],
              3, COUNTRY_COLORS[3],
              4, COUNTRY_COLORS[4],
              5, COUNTRY_COLORS[5],
              6, COUNTRY_COLORS[6],
              '#f1f3f5',
            ],
            'fill-opacity': 0.32,
          },
        });
      }
    } catch (e) {
      console.warn('Could not load country fill for Carto basemap:', e);
    }
  }

  return {
    version: 8,
    name: 'Travel Clean (Carto)',
    sources,
    layers,
  };
}

/**
 * Creates OpenStreetMap Standard Raster Style
 */
export function createOsmStandardStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'OpenStreetMap Standard',
    sources: {
      'osm-raster': {
        type: 'raster',
        tiles: [
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      },
    },
    layers: [
      {
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm-raster',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
}

/**
 * Fetches OpenFreeMap vector style with timeout
 */
async function fetchOpenFreeMapStyle(url: string, timeoutMs = 3500): Promise<StyleSpecification> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Master style builder for MapLibre
 */
export async function createTravelStyle(options: {
  styleId: MapLibreStyleId;
  enableCountryFill?: boolean;
  showAdmin1?: boolean;
}): Promise<StyleSpecification> {
  const { styleId, enableCountryFill = true, showAdmin1 = true } = options;

  // 1. Natural Earth 100% offline local vector map
  if (styleId === 'natural-earth') {
    return createNaturalEarthStyle({ showAdmin1 });
  }

  // 2. OpenStreetMap Standard
  if (styleId === 'osm-standard') {
    return createOsmStandardStyle();
  }

  // 3. Travel Clean (High-performance Carto Positron No-Labels)
  if (styleId === 'travel-clean') {
    try {
      return await createCartoTravelCleanStyle({ enableCountryFill });
    } catch (err) {
      console.warn('Carto style failed, falling back to local Natural Earth:', err);
      return createNaturalEarthStyle({ showAdmin1 });
    }
  }

  // 4. OpenFreeMap Vector Styles (Liberty / Positron)
  const openFreeMapUrls: Record<string, string> = {
    liberty: 'https://tiles.openfreemap.org/styles/liberty',
    positron: 'https://tiles.openfreemap.org/styles/positron',
  };

  const targetUrl = openFreeMapUrls[styleId] || openFreeMapUrls.positron;

  try {
    const style = await fetchOpenFreeMapStyle(targetUrl, 3500);

    // Optional country fill
    if (enableCountryFill) {
      try {
        const countriesGeo = await fetchGeoJSON('data/ne_110m_admin_0_countries.geojson');
        if (countriesGeo) {
          style.sources['ne-countries'] = {
            type: 'geojson',
            data: countriesGeo,
          } as any;

          const fillLayer: any = {
            id: 'ne-country-fill',
            type: 'fill',
            source: 'ne-countries',
            paint: {
              'fill-color': [
                'match',
                ['%', ['to-number', ['get', 'MAPCOLOR7'], 0], 7],
                0, COUNTRY_COLORS[0],
                1, COUNTRY_COLORS[1],
                2, COUNTRY_COLORS[2],
                3, COUNTRY_COLORS[3],
                4, COUNTRY_COLORS[4],
                5, COUNTRY_COLORS[5],
                6, COUNTRY_COLORS[6],
                '#f1f3f5',
              ],
              'fill-opacity': 0.45,
            },
          };

          const firstBoundary = style.layers.findIndex(
            (l) => l.id.includes('boundary') || l.id.includes('highway')
          );
          if (firstBoundary !== -1) {
            style.layers.splice(firstBoundary, 0, fillLayer);
          } else {
            style.layers.push(fillLayer);
          }
        }
      } catch (e) {
        console.warn('Could not inject country fill into OpenFreeMap style:', e);
      }
    }

    return style;
  } catch (err) {
    console.warn(`OpenFreeMap (${styleId}) failed or timed out, falling back to Travel Clean Carto:`, err);
    return createCartoTravelCleanStyle({ enableCountryFill });
  }
}

export function createOfflineFallbackStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'Offline Fallback',
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#e0edf8',
        },
      },
    ],
  };
}
