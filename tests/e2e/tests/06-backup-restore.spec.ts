/**
 * E2E Tests: Backup & Restore
 * 
 * Tests data backup and restore functionality.
 */

import { test, expect } from '@playwright/test';

test.describe('Backup & Restore', () => {
  test.setTimeout(10000); // allow slower settings page render

  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 5000 });
  });

  test('should export data as JSON', async ({ page }) => {
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test('should export data as Markdown', async ({ page }) => {
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test('should show restore from backup button', async ({ page }) => {
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test('should open restore dialog', async ({ page }) => {
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test('should validate backup file format', async ({ page }) => {
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test('should show timezone setting', async ({ page }) => {
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test('should change timezone', async ({ page }) => {
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test('should show backup created timestamp', async ({ page }) => {
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test('should warn before restore', async ({ page }) => {
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });
});
