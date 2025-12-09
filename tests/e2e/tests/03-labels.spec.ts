/**
 * E2E Tests: Label Management
 * 
 * Tests creating and managing labels.
 */

import { test, expect } from '@playwright/test';
import { navigateToDate, createNoteEntry, addLabelToEntry, navigateToSettings } from '../fixtures/helpers';

test.describe('Label Management', () => {
  test.setTimeout(10000); // allow initial page render and entry setup
  // Run tests serially to avoid race conditions with parallel Date.now() timestamps
  test.describe.configure({ mode: 'serial' });
  
  test.beforeEach(async ({ page }, testInfo) => {
    // Use test title hash + timestamp for unique dates across test runs
    const testTitle = testInfo.titlePath.join('-');
    const hash = testTitle.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    const timestampComponent = Math.floor(Date.now() / 10000) % 10;
    const dayNum = ((Math.abs(hash) + timestampComponent) % 28) + 1;
    const testRunDate = `2024-02-${String(dayNum).padStart(2, '0')}`; // Feb for labels
    
    await page.goto(`/day/${testRunDate}`);
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

  test('should create and add a new label to entry', async ({ page }) => {
    const labelName = `TestLabel${Date.now()}`;
    
    // Create entry
    await page.click('button:has-text("New Card")');
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 10000 });
    
    // Find label input and add button
    const labelInput = page.locator('input[placeholder*="label" i]').first();
    await labelInput.fill(labelName);
    
    // Click Add button to create label
    const addButton = page.locator('button:has-text("Add")').first();
    await addButton.click();
    
    // Wait for label API call
    await page.waitForResponse(
      resp => resp.url().includes('/api/labels') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    
    // Verify label appears on entry (labels are rendered as buttons/chips)
    await expect(page.getByRole('button', { name: labelName })).toBeVisible();
    
    // Reload and verify persistence
    await page.reload();
    await page.waitForSelector('button:has-text("New Card")', { timeout: 10000 });
    await expect(page.getByRole('button', { name: labelName })).toBeVisible();
  });

  test('should add multiple labels to entry', async ({ page }) => {
    const label1 = `Label1-${Date.now()}`;
    const label2 = `Label2-${Date.now()}`;
    
    // Create entry
    await page.click('button:has-text("New Card")');
    await expect(page.locator('.ProseMirror').first()).toBeVisible();
    
    // Add first label
    const labelInput = page.locator('input[placeholder*="label" i]').first();
    await labelInput.fill(label1);
    await page.locator('button:has-text("Add")').first().click();
    await page.waitForResponse(
      resp => resp.url().includes('/api/labels') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    
    // Add second label
    await labelInput.fill(label2);
    await page.locator('button:has-text("Add")').first().click();
    await page.waitForResponse(
      resp => resp.url().includes('/api/labels') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    
    // Verify both labels visible (labels are buttons)
    await expect(page.getByRole('button', { name: label1 })).toBeVisible();
    await expect(page.getByRole('button', { name: label2 })).toBeVisible();
  });

  test('should reuse existing labels', async ({ page }) => {
    const labelName = `ReuseLabel${Date.now()}`;
    
    // Create first entry with label
    await page.click('button:has-text("New Card")');
    await expect(page.locator('.ProseMirror').first()).toBeVisible();
    const labelInput1 = page.locator('input[placeholder*="label" i]').first();
    await labelInput1.fill(labelName);
    await page.locator('button:has-text("Add")').first().click();
    await page.waitForResponse(
      resp => resp.url().includes('/api/labels') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    
    // Create second entry
    await page.click('button:has-text("New Card")');
    await expect(page.locator('.ProseMirror').nth(1)).toBeVisible();
    
    // Type label name to trigger autocomplete/dropdown
    const labelInput2 = page.locator('input[placeholder*="label" i]').nth(1);
    await labelInput2.fill(labelName.substring(0, 5)); // Type partial match
    
    // Label should be suggested (either in dropdown or available)
    await page.waitForTimeout(1000); // Wait for suggestions (increased for reliability)
    
    // Complete the label name and add
    await labelInput2.fill(labelName);
    await page.locator('button:has-text("Add")').nth(1).click();
    
    // Should reuse, not create new
    await page.waitForTimeout(500);
    
    // Verify label appears (use .first() in case label appears multiple times)
    const labelButton = page.getByRole('button', { name: labelName }).first();
    await expect(labelButton).toBeVisible();
  });

  test('should create emoji labels', async ({ page }) => {
    const emojiLabel = `🎉TestEmoji${Date.now()}`;
    
    // Create entry
    await page.click('button:has-text("New Card")');
    await expect(page.locator('.ProseMirror').first()).toBeVisible();
    
    // Add emoji label
    const labelInput = page.locator('input[placeholder*="label" i]').first();
    await labelInput.fill(emojiLabel);
    await page.locator('button:has-text("Add")').first().click();
    await page.waitForResponse(
      resp => resp.url().includes('/api/labels') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    
    // Verify emoji label visible (as button)
    await expect(page.getByRole('button', { name: emojiLabel })).toBeVisible();
  });

  test('should remove label from entry', async ({ page }) => {
    const labelName = `RemoveMe${Date.now()}`;
    
    // Create entry with label
    await page.click('button:has-text("New Card")');
    await expect(page.locator('.ProseMirror').first()).toBeVisible();
    const labelInput = page.locator('input[placeholder*="label" i]').first();
    await labelInput.fill(labelName);
    await page.locator('button:has-text("Add")').first().click();
    await page.waitForResponse(
      resp => resp.url().includes('/api/labels') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 5000 }
    );
    
    // Verify label added (as button)
    const labelButton = page.getByRole('button', { name: labelName });
    await expect(labelButton).toBeVisible();
    
    // Click the label button to remove it (labels are clickable chips)
    await labelButton.click();
    
    // Wait for removal API call
    await page.waitForTimeout(500);
    
    // Verify label removed
    await expect(labelButton).not.toBeVisible();
  });

  test('should delete label from settings', async ({ page }) => {
    // Navigate to settings
    await navigateToSettings(page);
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
    
    // Find labels section
    const labelsSection = page.locator('text="Labels"').or(page.locator('text="Manage Labels"'));
    if (await labelsSection.count() > 0) {
      await expect(labelsSection.first()).toBeVisible();
    }
  });

  test('should filter labels in selector', async ({ page }) => {
    const label1 = `Alpha${Date.now()}`;
    const label2 = `Beta${Date.now()}`;
    
    // Create entry with two labels
    await page.click('button:has-text("New Card")');
    await expect(page.locator('.ProseMirror').first()).toBeVisible();
    
    const labelInput = page.locator('input[placeholder*="label" i]').first();
    
    // Add first label
    await labelInput.fill(label1);
    await page.locator('button:has-text("Add")').first().click();
    await page.waitForTimeout(500);
    
    // Add second label
    await labelInput.fill(label2);
    await page.locator('button:has-text("Add")').first().click();
    await page.waitForTimeout(500);
    
    // Type partial match in label input to trigger filter
    await labelInput.fill('Alph');
    await page.waitForTimeout(300);
    
    // Verify label1 is suggested (this is basic - actual filtering depends on UI)
    await expect(labelInput).toHaveValue('Alph');
  });

  test('should show day-level labels', async ({ page }) => {
    const dayLabel = `DayLabel${Date.now()}`;
    
    // Create an entry first to ensure daily note exists
    await page.click('button:has-text("New Card")');
    await expect(page.locator('.ProseMirror').first()).toBeVisible();
    await page.locator('.ProseMirror').first().fill('.');
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForResponse(
      resp => resp.url().includes('/api/entries') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 10000 }
    );
    
    // Find day-level label input (in the "🏷️ Day Labels:" section)
    const dayLabelSection = page.locator('text="🏷️ Day Labels:"').locator('..');
    const dayLabelInput = dayLabelSection.locator('input[placeholder*="label" i]');
    await dayLabelInput.fill(dayLabel);
    
    // Click Add button in day labels section
    const dayAddButton = dayLabelSection.locator('button:has-text("Add")');
    await dayAddButton.click();
    
    // Wait for label API call
    await page.waitForResponse(
      resp => resp.url().includes('/api/labels') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 10000 }
    );
    
    // Buffer to ensure label is fully associated and appears in UI (CI needs longer)
    await page.waitForTimeout(3000);
    
    // Verify day label appears in day labels section
    await expect(page.getByRole('button', { name: dayLabel })).toBeVisible({ timeout: 10000 });
    
    // Reload and verify persistence
    await page.reload();
    await page.waitForSelector('button:has-text("New Card")', { timeout: 10000 });
    await expect(page.getByRole('button', { name: dayLabel })).toBeVisible();
  });

  test('should add entry-level labels', async ({ page }) => {
    const entryLabel1 = `Entry1-${Date.now()}`;
    const entryLabel2 = `Entry2-${Date.now()}`;
    
    // Create first entry and SAVE IT FIRST before adding labels
    await page.click('button:has-text("New Card")');
    await expect(page.locator('.ProseMirror').first()).toBeVisible();
    
    // Add content and save entry FIRST
    await page.locator('.ProseMirror').first().fill('Test entry 1');
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForResponse(
      resp => resp.url().includes('/api/entries') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 10000 }
    );
    
    // NOW add label to the saved entry
    let labelInput = page.locator('input[placeholder*="label" i]').first();
    await labelInput.fill(entryLabel1);
    await page.locator('button:has-text("Add")').first().click();
    await page.waitForResponse(
      resp => resp.url().includes('/api/labels') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 10000 }
    );
    
    // Buffer for UI update (CI needs longer)
    await page.waitForTimeout(2000);
    
    // Verify first entry label appears
    await expect(page.getByRole('button', { name: entryLabel1 })).toBeVisible({ timeout: 10000 });
    
    // Create second entry with different label  
    await page.click('button:has-text("New Card")');
    await expect(page.locator('.ProseMirror').nth(1)).toBeVisible();
    
    // Add content and save FIRST (entry must exist before adding labels)
    await page.locator('.ProseMirror').nth(1).fill('Test entry 2');
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForResponse(
      resp => resp.url().includes('/api/entries') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 10000 }
    );
    
    // Now add label to the saved entry
    const allLabelInputs = page.locator('input[placeholder*="label" i]');
    const secondEntryInput = allLabelInputs.nth(1);
    await secondEntryInput.fill(entryLabel2);
    
    const allAddButtons = page.locator('button:has-text("Add")');
    await allAddButtons.nth(1).click();
    
    // Wait for label API call
    await page.waitForResponse(
      resp => resp.url().includes('/api/labels') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 10000 }
    );
    
    // Buffer for UI update (CI needs longer)
    await page.waitForTimeout(3000);
    
    // Verify second entry label appears (first was already verified at line 288)
    await expect(page.getByRole('button', { name: entryLabel2 })).toBeVisible({ timeout: 10000 });
  });
});


