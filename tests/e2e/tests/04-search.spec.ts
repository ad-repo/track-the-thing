/**
 * E2E Tests: Search Functionality
 *
 * Covers text search, filters, history, empty states, and ordering.
 */

import { expect, test } from '@playwright/test';

const labelsResponse = [
  { id: 1, name: 'urgent', color: '#ef4444' },
  { id: 2, name: 'feature', color: '#3b82f6' },
];

const makeEntry = (id: number, date: string, created_at: string, overrides: Record<string, unknown> = {}) => ({
  id,
  date,
  created_at,
  title: `Entry ${id}`,
  content: `<p>Content ${id}</p>`,
  content_type: 'rich_text',
  labels: [],
  is_important: false,
  is_completed: false,
  is_archived: false,
  is_pinned: false,
  ...overrides,
});

test.describe('Search Functionality', () => {
  test.setTimeout(10000); // allow initial search page render

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/labels/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(labelsResponse),
      });
    });

    await page.route('**/api/search-history/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { query: 'history-one', created_at: '2025-01-01T00:00:00Z' },
            { query: 'history-two', created_at: '2025-01-02T00:00:00Z' },
          ]),
        });
        return;
      }

      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return;
      }

      await route.continue();
    });

    // Default search handler; individual tests override via setSearchResponse
    let searchResponse = { entries: [], lists: [] };
    const requests: string[] = [];

    page.on('request', (req) => {
      if (req.url().includes('/api/search/all')) {
        requests.push(req.url());
      }
    });

    await page.route('**/api/search/all**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(searchResponse),
      });
    });

    // Helper to override response per test
    (page as any).setSearchResponse = (value: typeof searchResponse) => {
      searchResponse = value;
    };
    (page as any).getSearchRequests = () => requests;

    await page.goto('/search');
    await page.waitForSelector('input[placeholder="Search by text (optional)..."]', { timeout: 5000 });
  });

  test('searches by text once and shows results ordered by recency', async ({ page }) => {
    const latest = makeEntry(1, '2025-12-02', '2025-12-02T12:00:00Z', { is_important: true });
    const older = makeEntry(2, '2025-11-30', '2025-11-30T08:00:00Z', { is_completed: true });
    (page as any).setSearchResponse({ entries: [latest, older], lists: [] });

    await page.fill('input[placeholder="Search by text (optional)..."]', 'report');
    await page.keyboard.press('Enter');

    await expect(page.getByText(latest.title)).toBeVisible();
    await expect(page.getByText(older.title)).toBeVisible();

    const requests: string[] = (page as any).getSearchRequests();
    expect(requests.length).toBe(1);
    expect(requests[0]).toContain('q=report');

    // Ensure order matches response (recency first)
    const firstCard = page.locator('div.rounded-xl').nth(0);
    await expect(firstCard.getByText(latest.title)).toBeVisible();
  });

  test('combines label + status filters into search params', async ({ page }) => {
    const filtered = makeEntry(3, '2025-12-03', '2025-12-03T10:00:00Z', { is_important: true, is_completed: true });
    (page as any).setSearchResponse({ entries: [filtered], lists: [] });

    await page.getByRole('button', { name: 'Starred Only' }).click();
    await page.getByRole('button', { name: 'Completed Only' }).click();
    await page.getByRole('button', { name: 'Include Archived' }).click();
    await page.getByRole('button', { name: 'urgent' }).click();

    await page.getByRole('button', { name: 'Search' }).click();

    const requests: string[] = (page as any).getSearchRequests();
    const last = requests[requests.length - 1];
    expect(last).toContain('label_ids=1');
    expect(last).toContain('is_important=true');
    expect(last).toContain('is_completed=true');
    expect(last).toContain('include_archived=true');

    await expect(page.getByText(filtered.title)).toBeVisible();
  });

  test('shows search history pills and replays a search', async ({ page }) => {
    const replayed = makeEntry(4, '2025-12-04', '2025-12-04T09:00:00Z');
    (page as any).setSearchResponse({ entries: [replayed], lists: [] });

    await page.getByRole('button', { name: /history-two/i }).click();

    const requests: string[] = (page as any).getSearchRequests();
    const last = requests[requests.length - 1];
    expect(last).toContain('q=history-two');

    await expect(page.getByText(replayed.title)).toBeVisible();
  });

  test('shows empty state when no results are returned', async ({ page }) => {
    (page as any).setSearchResponse({ entries: [], lists: [] });

    await page.fill('input[placeholder="Search by text (optional)..."]', 'nothing-here');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page.getByText(/No results found/i)).toBeVisible();
  });

  test('clears results and filters', async ({ page }) => {
    (page as any).setSearchResponse({ entries: [makeEntry(5, '2025-12-05', '2025-12-05T07:00:00Z')], lists: [] });

    await page.fill('input[placeholder="Search by text (optional)..."]', 'clear-me');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('Entry 5')).toBeVisible();

    await page.getByRole('button', { name: 'Starred Only' }).click();
    await page.getByRole('button', { name: 'Completed Only' }).click();
    await page.getByRole('button', { name: 'clear' }).click();

    await expect(page.getByText('Entry 5')).toBeHidden({ timeout: 3000 });
    await expect(page.locator('input[placeholder="Search by text (optional)..."]')).toHaveValue('');
  });
});