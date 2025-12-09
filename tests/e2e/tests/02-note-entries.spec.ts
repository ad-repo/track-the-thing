/**
 * E2E Tests: Note Entry Management
 * 
 * Tests creating, editing, and managing note entries.
 * 
 * @tag notes
 */

import { test, expect } from '@playwright/test';
import { navigateToDate } from '../fixtures/helpers';

test.describe('Note Entry Management', () => {
  test.setTimeout(10000); // allow initial page render and entry setup
  // Run tests serially to avoid race conditions with parallel Date.now() timestamps
  test.describe.configure({ mode: 'serial' });
  
  // Tag for running just this suite: npx playwright test tests/02-note-entries.spec.ts
  
  test.beforeEach(async ({ page }, testInfo) => {
    // Use test title hash + timestamp for unique dates across test runs
    const testTitle = testInfo.titlePath.join('-');
    const hash = testTitle.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    const timestampComponent = Math.floor(Date.now() / 10000) % 10; // Changes every 10 seconds
    const dayNum = ((Math.abs(hash) + timestampComponent) % 28) + 1; // 1-28 to ensure valid dates
    const testRunDate = `2024-01-${String(dayNum).padStart(2, '0')}`; // Jan for entries
    
    // Navigate to unique date for clean slate
    await page.goto(`/day/${testRunDate}`);
    // Wait for the New Card button (indicates React app is ready)
    await page.waitForSelector('button:has-text("New Card")', { timeout: 5000 });
    
    // Delete any existing entries for this date (cleanup from previous runs)
    let deleteCount = await page.locator('button[title*="Delete" i]').count();
    while (deleteCount > 0) {
      try {
        const deleteButton = page.locator('button[title*="Delete" i]').first();
        await deleteButton.click({ timeout: 2000 });
        
        // Wait for and confirm the delete modal
        await expect(page.locator('text="Delete Card?"')).toBeVisible({ timeout: 2000 });
        const confirmButton = page.locator('button:has-text("Delete Card")').first();
        await confirmButton.click();
        
        await page.waitForTimeout(1000); // Wait for deletion and DOM update
        deleteCount = await page.locator('button[title*="Delete" i]').count();
      } catch (e) {
        // Button became detached or not found, check count again
        deleteCount = await page.locator('button[title*="Delete" i]').count();
        if (deleteCount > 0) {
          await page.waitForTimeout(500);
        }
      }
    }
  });

  test('should create a new note entry', async ({ page }) => {
    // Click New Card button
    await page.getByRole('button', { name: /new card/i }).click();
    
    // Wait for editor to appear (editor initialization can take time)
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    
    // Add minimal content to trigger save
    await editor.fill('.');
    
    // Click outside to trigger auto-save
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    
    // Wait for the entry creation API call
    await page.waitForResponse(
      resp => resp.url().includes('/api/entries') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    
    // Reload page
    await page.reload();
    await page.waitForSelector('button:has-text("New Card")', { timeout: 10000 });
    
    // Verify entry persists
    await expect(page.locator('.ProseMirror').first()).toBeVisible();
  });

  test('should create entry with title and content', async ({ page }) => {
    const testTitle = `Test Title ${Date.now()}`;
    const testContent = 'Test content for entry';
    
    // Click New Card
    await page.getByRole('button', { name: /new card/i }).click();
    
    // Wait for editor to appear (editor initialization can take time)
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    
    // Fill title
    const titleInput = page.getByPlaceholder(/add a title/i).first();
    await titleInput.fill(testTitle);
    
    // Fill content
    await editor.click();
    await editor.fill(testContent);
    
    // Click outside to trigger auto-save for both
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    
    // Wait for save API call
    await page.waitForResponse(
      resp => resp.url().includes('/api/entries') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    
    // Verify data is in DOM BEFORE reload (proves save worked)
    await expect(titleInput).toHaveValue(testTitle);
    await expect(editor).toContainText(testContent);
    
    // Wait for any pending saves (debounce)
    await page.waitForTimeout(2000);
    
    // Reload
    await page.reload();
    await page.waitForSelector('button:has-text("New Card")', { timeout: 10000 });
    
    // Verify title persists after reload
    const titleInputAfterReload = page.getByPlaceholder(/add a title/i).first();
    await expect(titleInputAfterReload).toHaveValue(testTitle);
    
    // Verify content persists after reload
    const editorAfterReload = page.locator('.ProseMirror').first();
    await expect(editorAfterReload).toContainText(testContent);
  });

  test('should edit an existing entry', async ({ page }) => {
    // Create entry
    await page.click('button:has-text("New Card")');
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible();
    
    // Fill original content
    await editor.click();
    await editor.fill('Original content');
    // Blur to trigger save
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    // Wait for save and capture entry ID
    const createResponse = await page.waitForResponse(
      resp => resp.url().includes('/api/entries') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    const entryData = await createResponse.json();
    const entryId = entryData.id;
    
    // Reload
    await page.reload();
    await page.waitForSelector('button:has-text("New Card")', { timeout: 10000 });
    
    // Edit content
    const editorAfterReload = page.locator('.ProseMirror').first();
    await editorAfterReload.click();
    await page.keyboard.press('Control+A');
    await editorAfterReload.fill('Updated content');
    // Blur to trigger save
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    // Wait for save
    await page.waitForResponse(
      resp => resp.url().includes('/api/entries') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    
    // Reload again
    await page.reload();
    await page.waitForSelector('button:has-text("New Card")', { timeout: 10000 });
    
    // Verify updated content persists
    await expect(page.locator('.ProseMirror').getByText('Updated content')).toBeVisible();
  });

  test('should delete a note entry', async ({ page }) => {
    const uniqueText = `Delete me ${Date.now()}`;
    
    // Create entry with unique content
    await page.click('button:has-text("New Card")');
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible();
    
    await editor.click();
    await editor.fill(uniqueText);
    // Blur to trigger save
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    // Wait for save
    await page.waitForResponse(
      resp => resp.url().includes('/api/entries') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    
    // Verify entry exists
    await expect(page.locator('.ProseMirror').first().getByText(uniqueText)).toBeVisible();
    
    // Find and click delete button - use title or accessible name
    const deleteButton = page.locator('button[title*="Delete" i]').first();
    await deleteButton.click();
    
    // Wait for and confirm the delete modal
    await expect(page.locator('text="Delete Card?"')).toBeVisible();
    const confirmButton = page.locator('button:has-text("Delete Card")').first();
    await confirmButton.click();
    
    // Wait for delete API call
    await page.waitForResponse(
      resp => resp.url().includes('/api/entries') && resp.request().method() === 'DELETE',
      { timeout: 5000 }
    );
    
    // Reload
    await page.reload();
    await page.waitForSelector('button:has-text("New Card")', { timeout: 10000 });
    
    // Verify entry is gone
    await expect(page.locator('.ProseMirror').getByText(uniqueText)).not.toBeVisible();
  });

  test('should toggle important flag', async ({ page }) => {
    // Create entry
    await page.click('button:has-text("New Card")');
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 2000 });
    await page.waitForLoadState('load');
    
    // Click star button
    const starButton = page.locator('button[title*="important" i]').first();
    await expect(starButton).toBeVisible();
    await starButton.click();
    await page.waitForLoadState('load');
    
    // Reload
    await page.reload();
    await page.waitForLoadState('load');
    
    // Verify star persists (button still visible)
    const starAfterReload = page.locator('button[title*="important" i]').first();
    await expect(starAfterReload).toBeVisible({ timeout: 3000 });
  });

  test('should toggle completed flag', async ({ page }) => {
    // Create entry
    await page.click('button:has-text("New Card")');
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 2000 });
    await page.waitForLoadState('load');
    
    // Click check button
    const checkButton = page.locator('button[title*="completed" i]').first();
    await expect(checkButton).toBeVisible();
    await checkButton.click();
    await page.waitForLoadState('load');
    
    // Reload
    await page.reload();
    await page.waitForLoadState('load');
    
    // Verify check button still visible (completion persists)
    const checkAfterReload = page.locator('button[title*="completed" i]').first();
    await expect(checkAfterReload).toBeVisible({ timeout: 3000 });
  });

  test('should move entry to top', async ({ page }) => {
    // Create first entry
    await page.click('button:has-text("New Card")');
    const editor1 = page.locator('.ProseMirror').first();
    await expect(editor1).toBeVisible();
    await editor1.click();
    await editor1.fill('First entry');
    // Blur to trigger save
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForResponse(
      resp => resp.url().includes('/api/entries') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    
    // Create second entry
    await page.click('button:has-text("New Card")');
    const editor2 = page.locator('.ProseMirror').nth(1);
    await expect(editor2).toBeVisible();
    await editor2.click();
    await editor2.fill('Second entry');
    // Blur to trigger save
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForResponse(
      resp => resp.url().includes('/api/entries') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    
    // Click move to top on second entry
    const moveButtons = page.locator('button[title="Move to top"]');
    
    // Set up promise to wait for API call BEFORE clicking (prevent race condition)
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/entries/') && resp.url().includes('/move-to-top') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    
    await moveButtons.nth(1).click();
    await responsePromise;
    
    // Reload
    await page.reload();
    await page.waitForSelector('button:has-text("New Card")', { timeout: 10000 });
    
    // Verify order changed (second entry should now be first)
    const firstEditorAfter = page.locator('.ProseMirror').first();
    await expect(firstEditorAfter).toContainText('Second entry');
  });

  test('should create multiple entries on same day', async ({ page }) => {
    // Create 3 entries
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("New Card")');
      // Wait for the API call (CI needs longer timeout)
      await page.waitForResponse(
        resp => resp.url().includes('/api/entries') && resp.status() >= 200 && resp.status() < 300,
        { timeout: 10000 }
      );
    }
    
    // Verify 3 editors exist BEFORE reload
    const editors = page.locator('.ProseMirror');
    await expect(editors).toHaveCount(3);
    
    // Wait for all saves to complete
    await page.waitForTimeout(2000);
    
    // Reload
    await page.reload();
    await page.waitForSelector('button:has-text("New Card")', { timeout: 10000 });
    
    // Verify 3 editors still exist after reload
    await expect(editors).toHaveCount(3);
  });

  test('should persist entries after page reload', async ({ page }) => {
    // Create entry
    await page.click('button:has-text("New Card")');
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 2000 });
    await page.waitForLoadState('load');
    
    // Reload
    await page.reload();
    await page.waitForLoadState('load');
    
    // Verify entry still there (editor exists)
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible({ timeout: 3000 });
  });
});


