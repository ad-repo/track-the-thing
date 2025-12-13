/**
 * Mock for @tauri-apps/plugin-fs
 * Used in tests to avoid Tauri desktop dependency
 */
export const readFile = async (_path: string): Promise<Uint8Array> => {
  console.log('[Mock] readFile called with:', _path);
  // Return an empty Uint8Array as mock file contents
  return new Uint8Array([]);
};

export const writeFile = async (_path: string, _contents: Uint8Array): Promise<void> => {
  console.log('[Mock] writeFile called with:', _path);
};

export const readDir = async (_path: string): Promise<Array<{ name: string; isDirectory: boolean }>> => {
  console.log('[Mock] readDir called with:', _path);
  return [];
};

export const exists = async (_path: string): Promise<boolean> => {
  console.log('[Mock] exists called with:', _path);
  return false;
};

export const mkdir = async (_path: string): Promise<void> => {
  console.log('[Mock] mkdir called with:', _path);
};

export const remove = async (_path: string): Promise<void> => {
  console.log('[Mock] remove called with:', _path);
};

