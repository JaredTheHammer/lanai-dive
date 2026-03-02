import { test, expect } from '@playwright/test';
import { mockAllApis } from './helpers/mock-apis.js';

test.describe('Dashboard view', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');
    // Wait for data to load
    await expect(page.locator('text=/updated/i')).toBeVisible({ timeout: 10_000 });
  });

  test('score gauge renders with numeric 0-100 value', async ({ page }) => {
    const gauge = page.locator('.score-ring');
    await expect(gauge).toBeVisible();

    // The score number is in a span.text-5xl sibling to the SVG
    const scoreSpan = page.locator('span.text-5xl');
    await expect(scoreSpan).toBeVisible();
    const scoreText = await scoreSpan.textContent();
    const score = parseInt(scoreText, 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('all 5 condition factors are visible', async ({ page }) => {
    const factors = ['Wind', 'Swell', 'Tide', 'Rain', 'Vis'];
    for (const factor of factors) {
      await expect(page.locator(`text=${factor}`).first()).toBeVisible();
    }
  });

  test('water temperature from buoy shows temperature', async ({ page }) => {
    // Buoy fixture: WTMP=24.5°C => 76.1°F => displayed as ~76°F
    await expect(page.locator('text=/\\d+°F/')).toBeVisible();
  });

  test('Species Guide button exists', async ({ page }) => {
    await expect(page.locator('text=/species guide/i')).toBeVisible();
  });

  test('Species Guide overlay opens on click', async ({ page }) => {
    const button = page.locator('text=/species guide/i');
    await button.click();

    // The overlay should show species content
    await expect(page.locator('text=/season/i').first()).toBeVisible();
  });
});
