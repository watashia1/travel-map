import { Place, PlaceRecord } from '../types';
import { parseCoordinateLine } from './coordinates';

let cachedPlaces: PlaceRecord[] | null = null;
let placesLoadingPromise: Promise<PlaceRecord[]> | null = null;

/**
 * Loads and caches the local places database
 */
export async function loadPlacesDatabase(): Promise<PlaceRecord[]> {
  if (cachedPlaces) {
    return cachedPlaces;
  }
  if (placesLoadingPromise) {
    return placesLoadingPromise;
  }

  placesLoadingPromise = (async () => {
    try {
      const response = await fetch('./data/places.json');
      if (!response.ok) {
        throw new Error(`Failed to load places.json: ${response.statusText}`);
      }
      const data: PlaceRecord[] = await response.json();
      cachedPlaces = data;
      return data;
    } catch (err) {
      console.warn('Could not load places.json via fetch, using fallback empty array', err);
      cachedPlaces = [];
      return [];
    } finally {
      placesLoadingPromise = null;
    }
  })();

  return placesLoadingPromise;
}

export interface PlaceSearchResult {
  status: 'resolved' | 'ambiguous' | 'unresolved';
  match?: PlaceRecord;
  candidates?: PlaceRecord[];
}

/**
 * Searches a place name in the loaded database
 */
export function searchPlaceInDb(query: string, places: PlaceRecord[]): PlaceSearchResult {
  const clean = query.trim().toLowerCase();
  if (!clean || places.length === 0) {
    return { status: 'unresolved' };
  }

  // 1. Exact match on displayName, name, or aliases
  const exactMatches = places.filter(p => {
    if (p.displayName.toLowerCase() === clean) return true;
    if (p.name.toLowerCase() === clean) return true;
    return p.aliases.some(a => a.toLowerCase() === clean);
  });

  if (exactMatches.length === 1) {
    return { status: 'resolved', match: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return { status: 'ambiguous', candidates: exactMatches };
  }

  // 2. Prefix / includes match if no exact match
  const partialMatches = places.filter(p => {
    if (p.displayName.toLowerCase().includes(clean)) return true;
    if (p.name.toLowerCase().includes(clean)) return true;
    return p.aliases.some(a => a.toLowerCase().includes(clean));
  });

  if (partialMatches.length === 1) {
    return { status: 'resolved', match: partialMatches[0] };
  }
  if (partialMatches.length > 1) {
    return { status: 'ambiguous', candidates: partialMatches };
  }

  return { status: 'unresolved' };
}

/**
 * Parses multiline input text into an array of Places
 */
export async function parseInputText(text: string, existingPlaces: Place[] = []): Promise<Place[]> {
  const placesDb = await loadPlacesDatabase();
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const result: Place[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Check if matching an existing place to preserve user drag offsets
    const existing = existingPlaces.find(p => p.rawInput === rawLine);

    // Check if line is coordinate
    const coordParsed = parseCoordinateLine(rawLine);
    if (coordParsed.isCoordinate) {
      const displayName = coordParsed.label || existing?.displayName || `地点 ${i + 1}`;
      result.push({
        id: existing?.id || `place-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        rawInput: rawLine,
        name: displayName,
        displayName: displayName,
        lat: coordParsed.lat,
        lon: coordParsed.lon,
        source: 'coordinates',
        order: i,
        status: 'resolved',
        manualOffsetX: existing?.manualOffsetX || 0,
        manualOffsetY: existing?.manualOffsetY || 0,
        labelOffsetX: existing?.labelOffsetX ?? 12,
        labelOffsetY: existing?.labelOffsetY ?? -12
      });
      continue;
    }

    // Otherwise search local place database
    const searchRes = searchPlaceInDb(rawLine, placesDb);

    if (searchRes.status === 'resolved' && searchRes.match) {
      const m = searchRes.match;
      result.push({
        id: existing?.id || `place-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        rawInput: rawLine,
        name: m.name,
        displayName: m.displayName,
        lat: m.lat,
        lon: m.lon,
        country: m.country,
        source: 'local-place-db',
        order: i,
        status: 'resolved',
        manualOffsetX: existing?.manualOffsetX || 0,
        manualOffsetY: existing?.manualOffsetY || 0,
        labelOffsetX: existing?.labelOffsetX ?? 12,
        labelOffsetY: existing?.labelOffsetY ?? -12
      });
    } else if (searchRes.status === 'ambiguous') {
      result.push({
        id: existing?.id || `place-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        rawInput: rawLine,
        name: rawLine,
        displayName: rawLine,
        lat: 0,
        lon: 0,
        source: 'local-place-db',
        order: i,
        status: 'ambiguous',
        ambiguousCandidates: searchRes.candidates,
        manualOffsetX: 0,
        manualOffsetY: 0,
        labelOffsetX: 12,
        labelOffsetY: -12
      });
    } else {
      // Unresolved
      result.push({
        id: existing?.id || `place-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        rawInput: rawLine,
        name: rawLine,
        displayName: rawLine,
        lat: 0,
        lon: 0,
        source: 'manual',
        order: i,
        status: 'unresolved',
        manualOffsetX: 0,
        manualOffsetY: 0,
        labelOffsetX: 12,
        labelOffsetY: -12
      });
    }
  }

  return result;
}