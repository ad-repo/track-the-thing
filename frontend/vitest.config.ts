import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['./tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/android/**'],
    testTimeout: 5000, // 5 second timeout per test
    hookTimeout: 5000, // 5 second timeout for hooks (beforeEach, afterEach, etc.)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './tests/coverage',
      exclude: [
        'node_modules/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'src/main.tsx',
        'vite.config.ts',
        'vitest.config.ts',
      ],
    },
    // Mock external Tauri plugins at the Vite level
    deps: {
      inline: ['@tauri-apps/plugin-opener', '@tauri-apps/api', '@tauri-apps/plugin-fs'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Redirect Tauri plugin imports to mock files
      '@tauri-apps/plugin-opener': path.resolve(__dirname, './tests/__mocks__/tauri-plugin-opener.ts'),
      '@tauri-apps/api/core': path.resolve(__dirname, './tests/__mocks__/tauri-api-core.ts'),
      '@tauri-apps/api/event': path.resolve(__dirname, './tests/__mocks__/tauri-api-event.ts'),
      '@tauri-apps/plugin-fs': path.resolve(__dirname, './tests/__mocks__/tauri-plugin-fs.ts'),
    },
  },
});

