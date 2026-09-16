import type { StyleSpecification } from 'maplibre-gl';
import { MapLibreStyleId } from '../types';

const STYLE_URLS: Record<string, string> = {
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  positron: 'https://tiles.openfreemap.org/styles/positron',
  'travel-clean': 'https://tiles.openfreemap.org/styles/positron',
};

const styleCache = new Map<string, any>();

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

export async function fetchBaseStyle(styleId: MapLibreStyleId): Promise<StyleSpecification> {
  const url = STYLE_URLS[styleId] || STYLE_URLS['travel-clean'];
  if (styleCache.has(url)) {
    return JSON.parse(JSON.stringify(styleCache.get(url)));
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load style from ${url}: ${response.statusText}`);
  }

  const data = await response.json();
  styleCache.set(url, data);
  return JSON.parse(JSON.stringify(data));
}

export async function createTravelStyle(options: {
  styleId: MapLibreStyleId;
  enableCountryFill?: boolean;
  showAdmin1?: boolean;
}): Promise<StyleSpecification> {
  const { styleId, enableCountryFill = true, showAdmin1 = true } = options;

  try {
    const style = await fetchBaseStyle(styleId);

    if (styleId === 'travel-clean') {
      // 1. Hide all symbol (text/icon/poi/road/city/country) layers so user travel items dominate
      style.layers = style.layers.filter((layer) => {
        if (layer.type === 'symbol') return false;
        if (layer.id.includes('label')) return false;
        if (layer.id.includes('name')) return false;
        if (layer.id.includes('shield')) return false;
        if (layer.id.includes('building')) return false;
        if (layer.id.includes('poi')) return false;
        return true;
      });

      // 2. Control admin1 boundaries (province/state level)
      if (!showAdmin1) {
        style.layers = style.layers.filter((l) => l.id !== 'boundary_3');
      }
    }

    // 3. Inject Natural Earth Country Multi-Color Fill if enabled
    if (enableCountryFill) {
      // Add geojson source for Natural Earth countries
      style.sources['ne-countries'] = {
        type: 'geojson',
        data: '/data/ne_110m_admin_0_countries.geojson',
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
            '#e8ecf1'
          ],
          'fill-opacity': 0.75,
        },
      };

      // Place country fill layer before boundary or road layers
      const firstBoundaryIndex = style.layers.findIndex((l) =>
        l.id.includes('boundary') || l.id.includes('waterway') || l.id.includes('highway')
      );

      if (firstBoundaryIndex !== -1) {
        style.layers.splice(firstBoundaryIndex, 0, fillLayer);
      } else {
        style.layers.push(fillLayer);
      }
    }

    return style;
  } catch (err) {
    console.warn('Network style fetch failed, using offline fallback style:', err);
    return createOfflineFallbackStyle();
  }
}

export function createOfflineFallbackStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'Offline Fallback',
    sources: {
      'ne-countries': {
        type: 'geojson',
        data: '/data/ne_110m_admin_0_countries.geojson',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#d8e5f0', // Ocean light blue
        },
      },
      {
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
            '#e8ecf1'
          ],
          'fill-opacity': 1.0,
        },
      },
      {
        id: 'country-borders',
        type: 'line',
        source: 'ne-countries',
        paint: {
          'line-color': '#b0bec5',
          'line-width': 1,
        },
      },
    ],
  };
}
