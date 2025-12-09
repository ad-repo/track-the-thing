/**
 * E2E Tests: Media Features
 *
 * Concrete flows for uploads, permissions, lightbox, and dictation.
 */

import { expect, Page, TestInfo, test } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

const ONE_BY_ONE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/lYTxuQAAAABJRU5ErkJggg==';

const writeImageFile = (name: string, extraBytes = 0) => {
  const filePath = path.join(os.tmpdir(), name);
  const base = Buffer.from(ONE_BY_ONE_PNG, 'base64');
  const padding = extraBytes > 0 ? Buffer.alloc(extraBytes, 0xff) : Buffer.alloc(0);
  fs.writeFileSync(filePath, Buffer.concat([base, padding]));
  return filePath;
};

const uniqueDateFor = (testInfo: TestInfo) => {
  const title = testInfo.titlePath.join('-');
  const hash = title.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
  const dayNum = (Math.abs(hash) % 28) + 1;
  return `2024-06-${String(dayNum).padStart(2, '0')}`;
};

const deleteEntriesForDate = async (page: Page) => {
  let deleteButtons = page.locator('button[title*="Delete" i]');
  let deleteCount = await deleteButtons.count();

  while (deleteCount > 0) {
    try {
      const deleteButton = deleteButtons.first();
      await deleteButton.click({ timeout: 2000 });
      await expect(page.locator('text="Delete Card?"')).toBeVisible({ timeout: 2000 });
      await page.locator('button:has-text("Delete Card")').first().click();
      await page.waitForTimeout(500);
    } catch (error) {
      // Element might have detached; retry until clean.
    }
    deleteButtons = page.locator('button[title*="Delete" i]');
    deleteCount = await deleteButtons.count();
  }
};

const createEntry = async (page: Page) => {
  await page.getByRole('button', { name: /new card/i }).click();
  const editor = page.locator('.ProseMirror').first();
  await expect(editor).toBeVisible({ timeout: 10000 });
  return editor;
};

const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

test.describe('Media Features', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }, testInfo) => {
    const testDate = uniqueDateFor(testInfo);
    await page.goto(`/day/${testDate}`);
    await page.waitForSelector('button:has-text("New Card")', { timeout: 10000 });
    await deleteEntriesForDate(page);
    await createEntry(page);
  });

  test('uploads image, opens lightbox, resizes responsively, and deletes', async ({ page }) => {
    const imagePath = writeImageFile(`e2e-media-${Date.now()}.png`);

    await page.route('**/api/uploads/image', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            url: '/api/uploads/e2e-test-image.png',
            filename: 'e2e-test-image.png',
          }),
        });
        return;
      }
      await route.continue();
    });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTitle(/Add Image/i).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(imagePath);

    const inlineImage = page.locator('.ProseMirror img[src*="e2e-test-image.png"]').first();
    await expect(inlineImage).toBeVisible({ timeout: 5000 });

    await inlineImage.click();
    const lightbox = page.locator('div.fixed:has(img[src*="e2e-test-image.png"])');
    await expect(lightbox).toBeVisible({ timeout: 3000 });
    await lightbox.click({ position: { x: 10, y: 10 } });
    await expect(lightbox).toBeHidden();

    const initialBox = await inlineImage.boundingBox();
    expect(initialBox).not.toBeNull();

    await page.setViewportSize({ width: 900, height: 900 });
    const resizedBox = await inlineImage.boundingBox();
    expect(resizedBox).not.toBeNull();
    if (initialBox && resizedBox) {
      expect(resizedBox.width).toBeLessThanOrEqual(initialBox.width + 1);
    }

    await page.evaluate(() => {
      const editorEl = document.querySelector('.ProseMirror');
      const selection = window.getSelection();
      if (editorEl && selection) {
        const range = document.createRange();
        range.selectNodeContents(editorEl);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });
    await page.keyboard.press('Delete');
    await expect(page.locator('.ProseMirror img')).toHaveCount(0);
  });

  test('shows error when image upload is rejected (oversize)', async ({ page }) => {
    const largeImagePath = writeImageFile(`e2e-media-large-${Date.now()}.png`, 800_000);

    await page.route('**/api/uploads/image', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 413,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'File too large' }),
        });
        return;
      }
      await route.continue();
    });

    const dialogPromise = page.waitForEvent('dialog');
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTitle(/Add Image/i).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(largeImagePath);

    const dialog = await dialogPromise;
    expect(dialog.message()).toMatch(/failed to upload image/i);
    await dialog.dismiss();

    await expect(page.locator('.ProseMirror img')).toHaveCount(0);
  });

  test('shows camera modal when permission is granted', async ({ page }) => {
    await page.evaluate(() => {
      const track = { stop: () => {} };
      const stream = { getTracks: () => [track] };
      if (!navigator.mediaDevices) {
        Object.defineProperty(navigator, 'mediaDevices', { value: {} });
      }
      navigator.mediaDevices.getUserMedia = () => Promise.resolve(stream as any);
    });

    await page.getByTitle(/Take Photo/i).click();
    await expect(page.getByRole('heading', { name: 'Take Photo' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Take Photo' })).toBeHidden();
  });

  test('shows camera error when permission is denied', async ({ page }) => {
    await page.evaluate(() => {
      if (!navigator.mediaDevices) {
        Object.defineProperty(navigator, 'mediaDevices', { value: {} });
      }
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });

    const dialogPromise = page.waitForEvent('dialog');
    await page.getByTitle(/Take Photo/i).click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toMatch(/failed to access camera/i);
    await dialog.dismiss();
    await expect(page.getByRole('heading', { name: 'Take Photo' })).toHaveCount(0);
  });

  test('toggles voice dictation indicator when permission is granted', async ({ page }) => {
    await page.evaluate(() => {
      const track = { stop: () => {} };
      const stream = { getTracks: () => [track] };
      if (!navigator.mediaDevices) {
        Object.defineProperty(navigator, 'mediaDevices', { value: {} });
      }
      navigator.mediaDevices.getUserMedia = () => Promise.resolve(stream as any);

      class MockRecognition {
        public onstart?: () => void;
        public onend?: () => void;
        public onresult?: () => void;
        start() {
          this.onstart?.();
        }
        stop() {
          this.onend?.();
        }
        abort() {}
      }

      (window as any).SpeechRecognition = MockRecognition;
      (window as any).webkitSpeechRecognition = MockRecognition;
    });

    const micButton = page.locator('button[title*="Voice"], button[title*="Start Voice"], button[title*="Stop Recording"]').first();
    await expect(micButton).toBeVisible({ timeout: 5000 });

    await micButton.click();
    await expect(micButton).toHaveClass(/recording-pulse/);

    await micButton.click();
    await expect(micButton).not.toHaveClass(/recording-pulse/);
  });

  test('shows voice dictation error when microphone is denied', async ({ page }) => {
    await page.evaluate(() => {
      if (!navigator.mediaDevices) {
        Object.defineProperty(navigator, 'mediaDevices', { value: {} });
      }
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));

      class MockRecognition {
        public onstart?: () => void;
        public onend?: () => void;
        start() {
          this.onstart?.();
        }
        stop() {
          this.onend?.();
        }
        abort() {}
      }

      (window as any).SpeechRecognition = MockRecognition;
      (window as any).webkitSpeechRecognition = MockRecognition;
    });

    const micButton = page.locator('button[title*="Voice"], button[title*="Dictation"]').first();
    await expect(micButton).toBeVisible({ timeout: 5000 });
    await micButton.click();

    const dictationAlert = page.locator('text=Voice Dictation Issue');
    await expect(dictationAlert).toBeVisible({ timeout: 4000 });
    await expect(page.locator('text=Microphone permission denied')).toBeVisible();
  });
});
