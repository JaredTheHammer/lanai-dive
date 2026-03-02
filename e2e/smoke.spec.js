import { test, expect } from '@playwright/test';
import { mockAllApis, mockAllApisError } from './helpers/mock-apis.js';

test.describe('Smoke tests', () => {
  test('app loads and displays header with Lanai Dive', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Lanai Dive/ })).toBeVisible();
  });

  test('three navigation tabs are visible', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');

    await expect(page.getByRole('button', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /compare/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /map/i })).toBeVisible();
  });

  test('updated timestamp appears after data loads', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');

    // Wait for data to load — the "Updated" text appears in the header
    await expect(page.locator('text=/updated/i')).toBeVisible({ timeout: 10_000 });
  });

  test('handles all-APIs-failing gracefully', async ({ page }) => {
    await mockAllApisError(page);
    await page.goto('/');

    // When all APIs fail, Header shows "X sources unavailable"
    await expect(page.locator('text=/unavailable/i')).toBeVisible({ timeout: 10_000 });
  });
});
