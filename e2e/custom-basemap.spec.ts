import { expect, Page, test } from '@playwright/test';

const routeStyle = {
  type: 'curved',
  mode: 'geodesic',
  strokeColor: '#e63946',
  strokeWidth: 2.5,
  strokeOpacity: 0.9,
  dashStyle: 'solid',
  showArrows: true,
};

const markerStyle = {
  type: 'dot',
  color: '#e63946',
  size: 7,
  strokeColor: '#ffffff',
  strokeWidth: 2,
};

const labelStyle = {
  fontSize: 12,
  color: '#1e293b',
  showHalo: true,
  fontWeight: 'medium',
  autoAvoidCollisions: true,
};

const places = [
  { id: 'tokyo', name: 'Tokyo', displayName: '东京', lat: 35.6762, lon: 139.6503 },
  { id: 'sapporo', name: 'Sapporo', displayName: '札幌', lat: 43.0618, lon: 141.3545 },
  { id: 'oslo', name: 'Oslo', displayName: '奥斯陆', lat: 59.9139, lon: 10.7522 },
  { id: 'reykjavik', name: 'Reykjavik', displayName: '雷克雅未克', lat: 64.1466, lon: -21.9426 },
].map((place, order) => ({
  ...place,
  order,
  source: 'coordinates',
  rawInput: place.displayName,
  status: 'resolved',
  geoStatus: 'resolved',
}));

async function seedProject(page: Page) {
  await page.addInitScript(
    ({ places, routeStyle, markerStyle, labelStyle }) => {
      if (sessionStorage.getItem('travel_map_e2e_seeded') === 'true') return;
      sessionStorage.setItem('travel_map_e2e_seeded', 'true');
      localStorage.setItem('travel_map_has_initialized_v3', 'true');
      localStorage.setItem(
        'travel_map_project_v3',
        JSON.stringify({
          version: '3.0',
          title: 'Custom basemap E2E',
          places,
          basemap: {
            type: 'polar',
            pole: 'south',
            projection: 'stereographic',
            oceanColor: '#e0f2fe',
            landColor: '#ffffff',
            borderColor: '#cbd5e1',
          },
          camera: { zoom: 1, panX: 0, panY: 0 },
          views: { polar: { zoom: 1, panX: 0, panY: 0 } },
          routeStyle,
          markerStyle,
          labelStyle,
          overlayScaleMode: 'screen-fixed',
        })
      );
    },
    { places, routeStyle, markerStyle, labelStyle }
  );
}

function svgUpload(width: number, height: number, name: string) {
  return {
    name,
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#dbeafe"/><path d="M0 ${height / 2} H${width}" stroke="#2563eb" stroke-width="8"/></svg>`
    ),
  };
}

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function openBasemapPanel(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '底图' }).click();
}

async function upload(page: Page, width: number, height: number, name: string) {
  await page.locator('input[type="file"]').setInputFiles(svgUpload(width, height, name));
  await expect(page.locator('#image-map-root')).toBeVisible();
  await expect(page.locator('#image-map-root image')).toHaveCount(1);
}

test('square upload stays usable, fits the measured viewport, and survives refresh', async ({ page }) => {
  await seedProject(page);
  await openBasemapPanel(page);
  const runtimeErrors = collectRuntimeErrors(page);

  await upload(page, 2160, 2160, 'square-map.svg');
  await expect(page.getByRole('button', { name: '自由底图 (手绘/导览)' })).toHaveClass(/border-purple-500/);
  await expect(page.locator('#markers-layer > g')).toHaveCount(0);

  const rootBox = await page.locator('#image-map-root').boundingBox();
  const imageBox = await page.locator('#image-map-root image').boundingBox();
  expect(rootBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(imageBox!.x).toBeGreaterThanOrEqual(rootBox!.x - 1);
  expect(imageBox!.y).toBeGreaterThanOrEqual(rootBox!.y - 1);
  expect(imageBox!.x + imageBox!.width).toBeLessThanOrEqual(rootBox!.x + rootBox!.width + 1);
  expect(imageBox!.y + imageBox!.height).toBeLessThanOrEqual(rootBox!.y + rootBox!.height + 1);

  await page.getByRole('button', { name: '点选定位' }).first().click();
  await page.locator('#image-map-root').click({
    position: {
      x: imageBox!.x - rootBox!.x + imageBox!.width * 0.35,
      y: imageBox!.y - rootBox!.y + imageBox!.height * 0.4,
    },
  });
  await expect(page.locator('#markers-layer > g')).toHaveCount(1);

  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator('#image-map-root')).toBeVisible();
  await expect(page.locator('#image-map-root image')).toHaveCount(1);
  await expect(page.locator('#markers-layer > g')).toHaveCount(1);
  expect(runtimeErrors).toEqual([]);
});

test('a 2:1 image remains free-image and only shows an equirectangular hint', async ({ page }) => {
  await seedProject(page);
  await openBasemapPanel(page);
  const runtimeErrors = collectRuntimeErrors(page);

  await upload(page, 2000, 1000, 'artwork-2-to-1.svg');
  await expect(page.getByText(/这张图片比例接近 2:1/)).toBeVisible();
  await expect(page.getByRole('button', { name: '自由底图 (手绘/导览)' })).toHaveClass(/border-purple-500/);
  await expect(page.getByRole('button', { name: '标准经纬世界图' })).not.toHaveClass(/border-purple-500/);
  expect(runtimeErrors).toEqual([]);
});

test('calibration pending is safe at 0, 1, and 2 points, then activates at 3 valid points', async ({ page }) => {
  await seedProject(page);
  await openBasemapPanel(page);
  const runtimeErrors = collectRuntimeErrors(page);

  await upload(page, 2160, 2160, 'calibration-map.svg');
  await page.getByRole('button', { name: '多点仿射校准 (推荐)' }).click();

  const pending = page.getByText(/校准尚未完成/);
  await expect(pending).toBeVisible();
  const root = page.locator('#image-map-root');
  const rootBox = await root.boundingBox();
  const imageBox = await root.locator('image').boundingBox();
  expect(rootBox).not.toBeNull();
  expect(imageBox).not.toBeNull();

  const positions = [
    { x: 0.28, y: 0.3 },
    { x: 0.72, y: 0.35 },
    { x: 0.48, y: 0.75 },
  ];

  for (let index = 0; index < positions.length; index++) {
    await page.getByRole('button', { name: '标定该点' }).first().click();
    await root.click({
      position: {
        x: imageBox!.x - rootBox!.x + imageBox!.width * positions[index].x,
        y: imageBox!.y - rootBox!.y + imageBox!.height * positions[index].y,
      },
    });

    if (index < 2) {
      await expect(pending).toBeVisible();
    }
    await expect(page.getByText('地图渲染发生错误')).toHaveCount(0);
  }

  await expect(pending).toHaveCount(0);
  await expect(page.locator('#markers-layer > g')).toHaveCount(4);
  expect(runtimeErrors).toEqual([]);
});

test('point picking rejects clicks outside the displayed image', async ({ page }) => {
  await seedProject(page);
  await openBasemapPanel(page);
  await upload(page, 2160, 2160, 'pick-bounds.svg');

  await page.getByRole('button', { name: '点选定位' }).first().click();
  await page.locator('#image-map-root').click({ position: { x: 10, y: 300 } });
  await expect(page.getByText('请点击图片有效区域内')).toBeVisible();
  await expect(page.getByText('请在底图上点击，指定此地点的精确位置')).toBeVisible();
  await expect(page.locator('#markers-layer > g')).toHaveCount(0);
});
