import { test, expect } from '@playwright/test';
import { mockAllApis } from './helpers/mock-apis.js';

test.describe('Map view', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');
    // Wait for data then switch to Map view
    await expect(page.locator('text=/updated/i')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /map/i }).click();
  });

  test('map container renders', async ({ page }) => {
    // MapLibre creates a div with class maplibregl-map or the wrapper has a known class
    const mapContainer = page.locator('.maplibregl-map, [class*="map-container"], canvas').first();
    await expect(mapContainer).toBeVisible({ timeout: 10_000 });
  });

  test('layer toggle labels are visible', async ({ page }) => {
    const labels = ['Depth contours', 'Ocean currents', 'Wind flow'];
    for (const label of labels) {
      await expect(page.locator(`text=${label}`)).toBeVisible();
    }
  });

  test('zone list shows 6 zone buttons', async ({ page }) => {
    // Zone names: South Shore, Southwest, West, Northwest, North, East
    // Exclude the "Best:" badge button which also contains a zone name
    const zoneButtons = page.locator('button:not(:has-text("Best"))', { hasText: /(South Shore|Southwest|West|Northwest|North|East)/i });
    await expect(zoneButtons).toHaveCount(6, { timeout: 10_000 });
  });

  test('clicking a zone opens bottom sheet', async ({ page }) => {
    // Click the first zone button (South Shore or Southwest)
    const zoneButton = page.locator('button', { hasText: /(South Shore|Southwest)/i }).first();
    await zoneButton.click();

    // Bottom sheet should appear with drag handle and slide-up animation
    const bottomSheet = page.locator('.drag-handle, .slide-up, [class*="bottom-sheet"]').first();
    await expect(bottomSheet).toBeVisible({ timeout: 5_000 });
  });
});
