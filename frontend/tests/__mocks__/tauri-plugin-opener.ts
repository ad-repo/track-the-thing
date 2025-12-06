/**
 * Mock for @tauri-apps/plugin-opener
 * Used in tests to avoid Tauri desktop dependency
 */
export const openUrl = async (url: string) => {
  console.log('[Mock] openUrl called with:', url);
};

