/**
 * Vitest global test setup
 */
import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import React from 'react';

// Define Vite globals that are normally injected at build time
(globalThis as any).__APP_VERSION__ = '0.0.0-test';

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
(globalThis as any).fetch = vi.fn();

// Mock IntersectionObserver
(globalThis as any).IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: vi.fn(),
}));

// Mock ResizeObserver
(globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock getClientRects for ProseMirror (TipTap)
if (typeof Element !== 'undefined') {
  Element.prototype.getClientRects = vi.fn().mockReturnValue({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {},
  });
  Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
}

// Mock Web Speech API
const mockSpeechRecognition = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  continuous: false,
  interimResults: false,
  lang: 'en-US',
  maxAlternatives: 1,
}));

Object.defineProperty(window, 'SpeechRecognition', {
  writable: true,
  value: mockSpeechRecognition,
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  writable: true,
  value: mockSpeechRecognition,
});

// Mock MediaDevices API
const mockGetUserMedia = vi.fn().mockResolvedValue({
  getTracks: () => [
    {
      stop: vi.fn(),
      kind: 'video',
      label: 'mock camera',
    },
  ],
});

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: vi.fn().mockResolvedValue([]),
  },
});

// Mock MediaRecorder
(globalThis as any).MediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  state: 'inactive',
  stream: null,
  mimeType: 'video/webm',
  ondataavailable: null,
  onerror: null,
  onstart: null,
  onstop: null,
})) as any;

// Mock URL.createObjectURL
(globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:mock-url');
(globalThis as any).URL.revokeObjectURL = vi.fn();

// Mock HTMLCanvasElement.toBlob
HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
  callback?.(new Blob([''], { type: 'image/png' }));
}) as any;

// Mock HTMLVideoElement
Object.defineProperty(HTMLVideoElement.prototype, 'play', {
  writable: true,
  value: vi.fn().mockResolvedValue(undefined),
});

Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
  writable: true,
  value: vi.fn(),
});

// Mock document.execCommand (for clipboard operations)
document.execCommand = vi.fn();

// Mock Clipboard API
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
});

// Mock EmojiLibraryContext
vi.mock('./src/contexts/EmojiLibraryContext', () => ({
  EmojiLibraryProvider: ({ children }: { children: React.ReactNode }) => children,
  useEmojiLibrary: () => ({
    emojiLibrary: 'emoji-picker-react',
    customEmojis: [],
    setEmojiLibrary: vi.fn(),
    refreshCustomEmojis: vi.fn(),
  }),
}));

// Mock EmojiPicker component
vi.mock('./src/components/EmojiPicker', () => ({
  default: ({ onEmojiSelect }: { onEmojiSelect?: (emoji: string, isCustom?: boolean, imageUrl?: string) => void }) => {
    return React.createElement('button', { onClick: () => onEmojiSelect?.('🔥', false, undefined) }, 'Mock Emoji Picker');
  },
}));

// Mock SprintNameContext
vi.mock('./src/contexts/SprintNameContext', () => ({
  SprintNameProvider: ({ children }: { children: React.ReactNode }) => children,
  useSprintName: () => ({
    sprintName: 'Sprint',
    setSprintName: vi.fn(),
  }),
}));

// Mock window.scrollTo
window.scrollTo = vi.fn();

// Mock TransparentLabelsContext - but allow real implementation for context tests
vi.mock('./src/contexts/TransparentLabelsContext', async () => {
  const actual = await vi.importActual<typeof import('./src/contexts/TransparentLabelsContext')>('./src/contexts/TransparentLabelsContext');
  return {
    ...actual,
    // Only mock for components that don't explicitly test the context
  };
});

