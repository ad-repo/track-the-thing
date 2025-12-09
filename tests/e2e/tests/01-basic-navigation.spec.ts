/**
 * E2E Tests: Basic Navigation
 * 
 * Tests fundamental navigation and page rendering.
 * 
 * @tag navigation
 */

import { test, expect } from '@playwright/test';

const todayPath = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `/day/${yyyy}-${mm}-${dd}`;
};

test.describe('Basic Navigation', () => {
  test.setTimeout(10000); // allow initial redirect and page render

  // Tag for running just this suite: npx playwright test --grep @navigation
  test('should load the home page', async ({ page }) => {
    await page.goto(todayPath());
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}/);
    
    // Should show main navigation
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should navigate to different dates', async ({ page }) => {
    await page.goto('/day/2025-11-07');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL('/day/2025-11-07');
  });

  test('should navigate to calendar view', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('load');
    
    // Should show calendar header
    await expect(page.locator('text=/sun|mon|tue|wed|thu|fri|sat/i').first()).toBeVisible();
  });

  test('should navigate to reports', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('load');
    
    // Should show reports heading
    await expect(page.locator('h1:has-text("Weekly Report")')).toBeVisible();
  });

  test('should navigate to settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('load');
    
    // Should show settings heading
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test('should navigate to search', async ({ page }) => {
    await page.goto('/search');
    await page.waitForSelector('input[placeholder="Search by text (optional)..."]', { timeout: 5000 });
  });

  test('should handle navigation between pages', async ({ page }) => {
    // Start at home - should redirect to today
    await page.goto(todayPath());
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}/);
    
    // Navigate to calendar
    await page.goto('/calendar');
    await page.waitForLoadState('load');
    await expect(page).toHaveURL('/calendar');
    
    // Navigate to reports
    await page.goto('/reports');
    await page.waitForLoadState('load');
    await expect(page).toHaveURL('/reports');
  });

  test('should maintain navigation state', async ({ page }) => {
    await page.goto('/day/2025-11-07');
    await page.waitForLoadState('load');
    
    // Navigate to calendar
    await page.goto('/calendar');
    await page.waitForLoadState('load');
    
    // Go back
    await page.goBack();
    await page.waitForLoadState('load');
    
    // Should still be on the same date
    await expect(page).toHaveURL('/day/2025-11-07');
  });
});


