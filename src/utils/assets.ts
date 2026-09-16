/**
 * Resolves relative asset paths against the current window location
 * Handles local dev (http://localhost:5173/...) and GitHub Pages (/travel-map/...)
 */
export function getAssetUrl(relativePath: string): string {
  const clean = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  if (typeof window !== 'undefined') {
    return new URL(clean, window.location.href).href;
  }
  return `./${clean}`;
}

const geoCache = new Map<string, any>();

export async function fetchGeoJSON(relativePath: string): Promise<any> {
  const clean = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;

  // In Node.js testing environment (Vitest)
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fsMod = 'node:fs';
      const pathMod = 'node:path';
      const nodeFs = await import(/* @vite-ignore */ fsMod);
      const nodePath = await import(/* @vite-ignore */ pathMod);
      const fullPath = nodePath.resolve(process.cwd(), 'public', clean);
      if (nodeFs.existsSync(fullPath)) {
        const raw = nodeFs.readFileSync(fullPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch {
      // Fall through to fetch
    }
  }

  const resolvedUrl = getAssetUrl(relativePath);
  if (geoCache.has(resolvedUrl)) {
    return geoCache.get(resolvedUrl);
  }

  const res = await fetch(resolvedUrl);
  if (!res.ok) {
    throw new Error(`Failed to load GeoJSON from ${resolvedUrl}: ${res.statusText}`);
  }

  const data = await res.json();
  geoCache.set(resolvedUrl, data);
  return data;
}
