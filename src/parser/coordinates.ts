export interface ParsedCoordinate {
  lat: number;
  lon: number;
  label?: string;
  isCoordinate: boolean;
}

/**
 * Normalizes symbols like unicode dashes, quotes, and commas
 */
function cleanCoordinateString(str: string): string {
  return str
    .replace(/[\u2212\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-') // Unicode minuses
    .replace(/[，、]/g, ',') // Chinese commas
    .replace(/[｜]/g, '|') // Fullwidth pipe
    .trim();
}

/**
 * Parses a DMS (Degrees, Minutes, Seconds) coordinate component
 * e.g., 35°40'34"N or 139°39'1"E
 */
function parseDMSComponent(str: string): number | null {
  const dmsRegex = /^([+-]?\d+(?:\.\d+)?)\s*[°度]?\s*(?:(\d+(?:\.\d+)?)\s*['′分]?\s*)?(?:(\d+(?:\.\d+)?)\s*["″秒]?\s*)?([NSEW北南东西])?$/i;
  const match = str.trim().match(dmsRegex);
  if (!match) return null;

  const deg = parseFloat(match[1]) || 0;
  const min = parseFloat(match[2]) || 0;
  const sec = parseFloat(match[3]) || 0;
  const dir = match[4] ? match[4].toUpperCase() : '';

  let decimal = Math.abs(deg) + min / 60 + sec / 3600;
  if (deg < 0 || dir === 'S' || dir === 'W' || dir === '南' || dir === '西') {
    decimal = -decimal;
  }
  return decimal;
}

/**
 * Attempt to parse a decimal or DMS number component
 */
function parseNumberOrDMS(str: string): number | null {
  const trimmed = str.trim();
  // Standard decimal float
  const numRegex = /^[+-]?\d+(?:\.\d+)?$/;
  if (numRegex.test(trimmed)) {
    const val = parseFloat(trimmed);
    return isNaN(val) ? null : val;
  }
  return parseDMSComponent(trimmed);
}

/**
 * Main coordinate parser function
 * Supported forms:
 * - "35.6762, 139.6503 | 东京"
 * - "35.6762, 139.6503"
 * - "35°40'34"N, 139°39'1"E | 东京"
 */
export function parseCoordinateLine(line: string): ParsedCoordinate {
  const cleaned = cleanCoordinateString(line);
  if (!cleaned) {
    return { lat: 0, lon: 0, isCoordinate: false };
  }

  let coordPart = cleaned;
  let labelPart: string | undefined = undefined;

  // Split by pipe '|' if present
  if (cleaned.includes('|')) {
    const parts = cleaned.split('|');
    coordPart = parts[0].trim();
    labelPart = parts.slice(1).join('|').trim();
  }

  // Attempt to split coordinate part by comma or whitespace
  let latStr = '';
  let lonStr = '';

  if (coordPart.includes(',')) {
    const parts = coordPart.split(',');
    if (parts.length >= 2) {
      latStr = parts[0].trim();
      lonStr = parts[1].trim();
    }
  } else if (coordPart.includes(';')) {
    const parts = coordPart.split(';');
    if (parts.length >= 2) {
      latStr = parts[0].trim();
      lonStr = parts[1].trim();
    }
  } else {
    // Attempt whitespace split between two coordinates
    const tokens = coordPart.split(/\s+/);
    if (tokens.length >= 2) {
      latStr = tokens[0].trim();
      lonStr = tokens[1].trim();
    }
  }

  if (!latStr || !lonStr) {
    return { lat: 0, lon: 0, label: labelPart, isCoordinate: false };
  }

  const lat = parseNumberOrDMS(latStr);
  const lon = parseNumberOrDMS(lonStr);

  if (lat === null || lon === null) {
    return { lat: 0, lon: 0, label: labelPart, isCoordinate: false };
  }

  // Validate bounds
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { lat: 0, lon: 0, label: labelPart, isCoordinate: false };
  }

  return {
    lat,
    lon,
    label: labelPart,
    isCoordinate: true
  };
}