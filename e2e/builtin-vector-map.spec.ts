import { expect, test } from '@playwright/test';

test('bundles the MapLibre worker and renders Natural Earth land polygons', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('travel_map_has_initialized_v3', 'true');
    localStorage.setItem(
      'travel_map_project_v3',
      JSON.stringify({
        version: '3.0',
        title: 'Natural Earth worker regression',
        places: [],
        basemap: {
          type: 'builtin-maplibre',
          styleId: 'natural-earth',
          enableCountryFill: true,
          showAdmin1: true,
        },
        camera: { zoom: 1, panX: 0, panY: 0 },
        views: {
          builtin: { center: [20, 20], zoom: 1.8, bearing: 0, pitch: 0 },
        },
        routeStyle: {
          type: 'curved',
          mode: 'geodesic',
          strokeColor: '#e63946',
          strokeWidth: 2.5,
          strokeOpacity: 0.9,
          dashStyle: 'solid',
          showArrows: true,
        },
        markerStyle: {
          type: 'dot',
          color: '#e63946',
          size: 7,
          strokeColor: '#ffffff',
          strokeWidth: 2,
        },
        labelStyle: {
          fontSize: 12,
          color: '#1e293b',
          showHalo: true,
          fontWeight: 'medium',
          autoAvoidCollisions: true,
        },
        overlayScaleMode: 'screen-fixed',
      })
    );
  });

  const criticalErrors: string[] = [];
  page.on('pageerror', (error) => criticalErrors.push(error.message));
  page.on('requestfailed', (request) => {
    if (request.url().includes('maplibre-gl-worker') || request.url().includes('/data/')) {
      criticalErrors.push(`${request.url()}: ${request.failure()?.errorText}`);
    }
  });
  page.on('response', (response) => {
    if (
      response.status() >= 400 &&
      (response.url().includes('maplibre-gl-worker') || response.url().includes('/data/'))
    ) {
      criticalErrors.push(`${response.status()}: ${response.url()}`);
    }
  });

  const workerResponse = page.waitForResponse(
    (response) => response.url().includes('maplibre-gl-worker') && response.status() === 200
  );

  await page.goto('/');
  await workerResponse;
  await expect(page.locator('#maplibre-global-root')).toHaveAttribute('data-map-loaded', 'true');

  const nonOceanPixels = await page.locator('#maplibre-canvas-container canvas').evaluate(
    (canvas: HTMLCanvasElement) => {
      const gl =
        canvas.getContext('webgl2', { preserveDrawingBuffer: true }) ||
        canvas.getContext('webgl', { preserveDrawingBuffer: true });
      if (!gl) return 0;

      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        if (Math.abs(red - 224) + Math.abs(green - 237) + Math.abs(blue - 248) > 18) {
          count++;
        }
      }
      return count;
    }
  );

  expect(nonOceanPixels).toBeGreaterThan(10_000);
  expect(criticalErrors).toEqual([]);
});
