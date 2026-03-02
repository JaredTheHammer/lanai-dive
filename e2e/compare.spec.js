import { test, expect } from '@playwright/test';
import { mockAllApis } from './helpers/mock-apis.js';

test.describe('Compare view', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');
    // Wait for data then switch to Compare view
    await expect(page.locator('text=/updated/i')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /compare/i }).click();
  });

  test('Zone Comparison heading is visible', async ({ page }) => {
    await expect(page.locator('text=/zone comparison/i')).toBeVisible();
  });

  test('6 zone cards render', async ({ page }) => {
    const cards = page.getByRole('article');
    await expect(cards).toHaveCount(6);
  });

  test('BEST badge appears on exactly 1 card', async ({ page }) => {
    const bestBadges = page.locator('text=/BEST/');
    await expect(bestBadges).toHaveCount(1);
  });

  test('sort controls change active state', async ({ page }) => {
    // Click on "Swell" sort button
    const swellSort = page.locator('button', { hasText: /swell/i }).first();
    await swellSort.click();

    // The clicked button should have cyan active styling
    await expect(swellSort).toHaveClass(/cyan/);
  });

  test('View on map text appears 6 times', async ({ page }) => {
    const viewOnMap = page.locator('text=/view on map/i');
    await expect(viewOnMap).toHaveCount(6);
  });
});
