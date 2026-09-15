const DB_NAME = 'TravelMapAssetDB';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves an image Blob into IndexedDB and returns an assetId
 */
export async function saveImageBlob(blob: Blob, name?: string): Promise<string> {
  const db = await openDB();
  const id = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record = {
      id,
      name: name || 'basemap.png',
      blob,
      mimeType: blob.type,
      size: blob.size,
      createdAt: new Date().toISOString()
    };

    const request = store.put(record);
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Loads an image Blob from IndexedDB by assetId
 */
export async function getImageBlob(assetId: string): Promise<Blob | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(assetId);

    request.onsuccess = () => {
      if (request.result && request.result.blob) {
        resolve(request.result.blob);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Returns a temporary Object URL for rendering, cached in memory
 */
const objectUrlCache = new Map<string, string>();

export async function getImageObjectUrl(assetId: string): Promise<string | null> {
  if (objectUrlCache.has(assetId)) {
    return objectUrlCache.get(assetId)!;
  }

  const blob = await getImageBlob(assetId);
  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  objectUrlCache.set(assetId, url);
  return url;
}

/**
 * Reads an image Blob as a Base64 Data URL (for SVG inlining during export)
 */
export async function getImageDataUrl(assetId: string): Promise<string | null> {
  const blob = await getImageBlob(assetId);
  if (!blob) return null;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Deletes an asset from IndexedDB
 */
export async function deleteImageBlob(assetId: string): Promise<void> {
  const db = await openDB();
  if (objectUrlCache.has(assetId)) {
    URL.revokeObjectURL(objectUrlCache.get(assetId)!);
    objectUrlCache.delete(assetId);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(assetId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}