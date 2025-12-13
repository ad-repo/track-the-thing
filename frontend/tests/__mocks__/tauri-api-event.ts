/**
 * Mock for @tauri-apps/api/event
 * Used in tests to avoid Tauri desktop dependency
 */
export const listen = async <T>(_event: string, _handler: (event: { payload: T }) => void): Promise<() => void> => {
  console.log('[Mock] listen called for event:', _event);
  // Return a no-op unlisten function
  return () => {};
};

export const emit = async (_event: string, _payload?: unknown) => {
  console.log('[Mock] emit called for event:', _event);
};

export const once = async <T>(_event: string, _handler: (event: { payload: T }) => void): Promise<() => void> => {
  console.log('[Mock] once called for event:', _event);
  return () => {};
};

