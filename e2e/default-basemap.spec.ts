import { expect, Page, test } from '@playwright/test';

async function mockLibertyStyle(page: Page) {
  await page.route('https://tiles.openfreemap.org/styles/liberty', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        name: 'OpenFreeMap Liberty test fixture',
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#dbeafe' },
          },
        ],
      }),
    });
  });
}

test('uses OpenFreeMap color by default and lists Travel Clean last', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('travel_map_project_v3');
    localStorage.removeItem('travel_map_project_v2');
    localStorage.setItem('travel_map_has_initialized_v3', 'true');
  });

  await mockLibertyStyle(page);

  await page.goto('/');
  await expect(page.locator('#maplibre-global-root')).toHaveAttribute('data-map-loaded', 'true');
  await page.getByRole('button', { name: '底图' }).click();

  const styleOptions = page.getByTestId('maplibre-style-options').locator('button');
  await expect(styleOptions).toHaveCount(5);
  await expect
    .poll(() => styleOptions.evaluateAll((buttons) => buttons.map((button) => button.dataset.styleId)))
    .toEqual(['liberty', 'positron', 'natural-earth', 'osm-standard', 'travel-clean']);
  await expect(page.locator('[data-style-id="liberty"]')).toHaveClass(/border-blue-500/);
  await expect(styleOptions.last()).toHaveAttribute('data-style-id', 'travel-clean');
});

test('migrates the previous Travel Clean default to OpenFreeMap color once', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('travel_map_default_basemap_liberty_v1');
    localStorage.setItem('travel_map_has_initialized_v3', 'true');
    localStorage.setItem(
      'travel_map_project_v3',
      JSON.stringify({
        version: '3.0',
        title: 'Previous default project',
        places: [],
        basemap: {
          type: 'builtin-maplibre',
          styleId: 'travel-clean',
          enableCountryFill: true,
          showAdmin1: true,
        },
        camera: { zoom: 1, panX: 0, panY: 0 },
        views: { builtin: { center: [20, 20], zoom: 1.8, bearing: 0, pitch: 0 } },
      })
    );
  });
  await mockLibertyStyle(page);

  await page.goto('/');
  await expect(page.locator('#maplibre-global-root')).toHaveAttribute('data-map-loaded', 'true');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem('travel_map_project_v3') || '{}');
        return stored.basemap?.styleId;
      })
    )
    .toBe('liberty');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('travel_map_default_basemap_liberty_v1')))
    .toBe('true');
});
