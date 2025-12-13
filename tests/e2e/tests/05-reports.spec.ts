/**
 * E2E Tests: Reports
 *
 * Covers weekly generation, week selection, empty states, and selected entries export.
 */

import { expect, test } from '@playwright/test';

const weekList = {
  weeks: [
    { start: '2025-11-26', end: '2025-12-03', label: 'Nov 26 - Dec 3' },
    { start: '2025-11-19', end: '2025-11-26', label: 'Nov 19 - Nov 26' },
  ],
};

const weeklyReport = {
  week_start: '2025-11-26',
  week_end: '2025-12-03',
  entries: [
    {
      entry_id: 1,
      date: '2025-11-27',
      created_at: '2025-11-27T12:00:00Z',
      content: '<p>Weekly note</p>',
      content_type: 'rich_text',
      labels: [{ name: 'urgent', color: '#ef4444' }],
      is_completed: true,
      is_important: true,
    },
  ],
};

const emptyWeeklyReport = { ...weeklyReport, entries: [] };

const selectedEntriesReport = {
  generated_at: '2025-12-03T10:00:00Z',
  entries: [
    {
      entry_id: 2,
      date: '2025-12-01',
      created_at: '2025-12-01T09:00:00Z',
      content: '<p>Selected entry</p>',
      content_type: 'rich_text',
      labels: [{ name: 'feature', color: '#3b82f6' }],
      is_completed: false,
      is_important: false,
    },
  ],
};

test.describe('Reports', () => {
  test.setTimeout(10000); // allow slower page render while keeping global defaults

  test.beforeEach(async ({ page }) => {
    let currentWeekly = weeklyReport;
    let currentSelected = selectedEntriesReport;
    const generateRequests: string[] = [];

    await page.route('**/api/reports/weeks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(weekList),
      });
    });

    await page.route('**/api/reports/generate**', async (route) => {
      generateRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentWeekly),
      });
    });

    await page.route('**/api/reports/all-entries**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentSelected),
      });
    });

    await page.route('**/api/entries/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.exposeFunction('setWeeklyReport', (report: typeof weeklyReport) => {
      currentWeekly = report;
    });
    await page.exposeFunction('setSelectedReport', (report: typeof selectedEntriesReport) => {
      currentSelected = report;
    });
    await page.exposeFunction('getGenerateRequests', () => generateRequests);

    await page.addInitScript(() => {
      Object.assign(navigator, {
        clipboard: {
          writeText: () => Promise.resolve(),
        },
      });
    });

    await page.goto('/reports');
    await page.waitForSelector('h1:has-text("Weekly Report")', { timeout: 5000 });
  });

  test('generates weekly report and exports markdown', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Generate' }).click();

    await expect(page.getByText('Weekly note')).toBeVisible();
    await expect(page.getByText(/2025-11-26 to 2025-12-03/)).toBeVisible();

    await page.getByRole('button', { name: 'Export as Markdown' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('weekly-report');
  });

  test('selects past week and calls API with date param', async ({ page }) => {
    await page.getByRole('button', { name: 'Generate' }).click();

    await page.getByRole('combobox').selectOption('2025-11-19');

    const requests: string[] = await page.evaluate(() => (window as any).getGenerateRequests());
    const last = requests[requests.length - 1];
    expect(last).toContain('date=2025-11-19');
  });

  test('shows empty-state guidance when weekly report has no entries', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).setWeeklyReport({
        week_start: '2025-11-26',
        week_end: '2025-12-03',
        entries: [],
      });
    });

    await page.getByRole('button', { name: 'Generate' }).click();
    await expect(page.getByText(/No entries marked for report this week/i)).toBeVisible();
  });

  test('generates selected entries report, exports, and clears flags', async ({ page }) => {
    await page.getByRole('button', { name: /^Generate$/ }).nth(1).click();
    await expect(page.getByText('Selected entry')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export to Markdown' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('all-entries');

    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(page.getByRole('button', { name: 'Clear All' })).toBeDisabled();
  });

  test('shows empty state for selected entries report', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).setSelectedReport({
        generated_at: '2025-12-03T10:00:00Z',
        entries: [],
      });
    });

    await page.getByRole('button', { name: /^Generate$/ }).nth(1).click();
    await expect(page.getByText(/No entries found/i)).toBeVisible();
  });
});