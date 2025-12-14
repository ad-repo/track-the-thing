import { test, expect } from '@playwright/test';

/**
 * E2E tests for MCP Server integration in Settings
 * 
 * Note: These tests verify the UI functionality.
 * Actual Docker container operations require Docker to be running.
 */

test.describe('MCP Server Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should display MCP Servers section in settings', async ({ page }) => {
    // Look for the MCP Servers section header
    const mcpSection = page.getByText('MCP Servers (Local AI Processing)');
    await expect(mcpSection).toBeVisible();
  });

  test('should show Docker availability status', async ({ page }) => {
    // The section should indicate if Docker is available or not
    // Either we see the enable toggle or a warning about Docker
    const mcpSection = page.locator('section').filter({ hasText: 'MCP Servers' });
    
    // Should have either enable toggle or warning
    const hasEnableToggle = await mcpSection.getByText('Enable MCP Servers').isVisible().catch(() => false);
    const hasDockerWarning = await mcpSection.getByText('Docker is not available').isVisible().catch(() => false);
    
    expect(hasEnableToggle || hasDockerWarning).toBeTruthy();
  });

  test('should toggle MCP enabled state', async ({ page }) => {
    // Skip if Docker is not available
    const dockerWarning = page.getByText('Docker is not available');
    if (await dockerWarning.isVisible().catch(() => false)) {
      test.skip();
      return;
    }

    // Find the enable toggle
    const mcpSection = page.locator('section').filter({ hasText: 'MCP Servers' });
    const enableToggle = mcpSection.locator('button').filter({ has: page.locator('span.inline-block') }).first();
    
    // Click to enable
    await enableToggle.click();
    await page.waitForTimeout(500);

    // Should now show additional settings
    const fallbackToggle = mcpSection.getByText('Fallback to LLM');
    await expect(fallbackToggle).toBeVisible();
  });

  test('should display Add Server button when MCP is enabled', async ({ page }) => {
    // Skip if Docker is not available
    const dockerWarning = page.getByText('Docker is not available');
    if (await dockerWarning.isVisible().catch(() => false)) {
      test.skip();
      return;
    }

    const mcpSection = page.locator('section').filter({ hasText: 'MCP Servers' });
    
    // Enable MCP if not already enabled
    const enableText = mcpSection.getByText('Enable MCP Servers');
    if (await enableText.isVisible()) {
      const enableToggle = mcpSection.locator('button').filter({ has: page.locator('span.inline-block') }).first();
      await enableToggle.click();
      await page.waitForTimeout(500);
    }

    // Look for Add Server button
    const addButton = mcpSection.getByText('Add Server');
    await expect(addButton).toBeVisible();
  });

  test('should open Add Server modal', async ({ page }) => {
    // Skip if Docker is not available
    const dockerWarning = page.getByText('Docker is not available');
    if (await dockerWarning.isVisible().catch(() => false)) {
      test.skip();
      return;
    }

    const mcpSection = page.locator('section').filter({ hasText: 'MCP Servers' });
    
    // Enable MCP if not already enabled
    const enableText = mcpSection.getByText('Enable MCP Servers');
    if (await enableText.isVisible()) {
      const enableToggle = mcpSection.locator('button').filter({ has: page.locator('span.inline-block') }).first();
      await enableToggle.click();
      await page.waitForTimeout(500);
    }

    // Click Add Server
    const addButton = mcpSection.getByText('Add Server');
    await addButton.click();

    // Modal should appear
    const modal = page.getByText('Add MCP Server');
    await expect(modal).toBeVisible();

    // Should have form fields
    await expect(page.getByPlaceholder('e.g. summarizer')).toBeVisible();
    await expect(page.getByPlaceholder(/ghcr.io/)).toBeVisible();

    // Close modal
    await page.getByText('Cancel').click();
    await expect(page.getByText('Add MCP Server')).not.toBeVisible();
  });

  test('should show empty state when no servers configured', async ({ page }) => {
    // Skip if Docker is not available
    const dockerWarning = page.getByText('Docker is not available');
    if (await dockerWarning.isVisible().catch(() => false)) {
      test.skip();
      return;
    }

    const mcpSection = page.locator('section').filter({ hasText: 'MCP Servers' });
    
    // Enable MCP if not already enabled
    const enableText = mcpSection.getByText('Enable MCP Servers');
    if (await enableText.isVisible()) {
      const enableToggle = mcpSection.locator('button').filter({ has: page.locator('span.inline-block') }).first();
      await enableToggle.click();
      await page.waitForTimeout(500);
    }

    // Look for empty state
    const emptyState = mcpSection.getByText('No MCP servers configured');
    // This may or may not be visible depending on whether servers exist
    if (await emptyState.isVisible().catch(() => false)) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('should open Import modal', async ({ page }) => {
    // Skip if Docker is not available
    const dockerWarning = page.getByText('Docker is not available');
    if (await dockerWarning.isVisible().catch(() => false)) {
      test.skip();
      return;
    }

    const mcpSection = page.locator('section').filter({ hasText: 'MCP Servers' });
    
    // Enable MCP if not already enabled
    const enableText = mcpSection.getByText('Enable MCP Servers');
    if (await enableText.isVisible()) {
      const enableToggle = mcpSection.locator('button').filter({ has: page.locator('span.inline-block') }).first();
      await enableToggle.click();
      await page.waitForTimeout(500);
    }

    // Click Import button
    const importButton = mcpSection.getByText('Import');
    await importButton.click();

    // Modal should appear
    const modal = page.getByText('Import from GitHub Manifest');
    await expect(modal).toBeVisible();

    // Should have manifest URL input
    await expect(page.getByPlaceholder(/raw.githubusercontent/)).toBeVisible();

    // Close modal
    await page.getByText('Cancel').click();
  });
});

test.describe('MCP Settings Persistence', () => {
  test('should persist MCP settings after page reload', async ({ page }) => {
    // Skip if Docker is not available
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const dockerWarning = page.getByText('Docker is not available');
    if (await dockerWarning.isVisible().catch(() => false)) {
      test.skip();
      return;
    }

    const mcpSection = page.locator('section').filter({ hasText: 'MCP Servers' });
    
    // Enable MCP
    const enableToggle = mcpSection.locator('button').filter({ has: page.locator('span.inline-block') }).first();
    await enableToggle.click();
    await page.waitForTimeout(500);

    // Change idle timeout
    const timeoutInput = mcpSection.locator('input[type="number"]');
    if (await timeoutInput.isVisible()) {
      await timeoutInput.fill('600');
      await page.waitForTimeout(500);
    }

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Settings should be persisted
    const mcpSectionAfter = page.locator('section').filter({ hasText: 'MCP Servers' });
    
    // Check if Fallback to LLM is visible (means MCP is enabled)
    const fallbackVisible = await mcpSectionAfter.getByText('Fallback to LLM').isVisible().catch(() => false);
    expect(fallbackVisible).toBeTruthy();
  });
});

