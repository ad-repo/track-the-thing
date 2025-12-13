import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWindowSize, useMediaQuery } from '@/hooks/useWindowSize';

describe('useWindowSize', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (global as any).innerWidth = 1024;
    (global as any).innerHeight = 768;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('provides initial dimensions and breakpoints', () => {
    const { result } = renderHook(() => useWindowSize());

    expect(result.current.width).toBe(1024);
    expect(result.current.height).toBe(768);
    expect(result.current.breakpoints).toMatchObject({
      isDesktop: false,
      isTabletLandscape: true,
    });
  });

  it('debounces resize updates and cleans up listener', () => {
    const addListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { result, unmount } = renderHook(() => useWindowSize());

    act(() => {
      (global as any).innerWidth = 640;
      (global as any).innerHeight = 480;
      window.dispatchEvent(new Event('resize'));
    });

    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(result.current.width).toBe(1024);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.width).toBe(640);
    expect(result.current.breakpoints.isMobile).toBe(true);

    unmount();
    expect(removeListenerSpy).toHaveBeenCalled();

    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
  });
});

describe('useMediaQuery', () => {
  it('listens to media query changes', () => {
    const listeners: Array<() => void> = [];
    const mockMedia = {
      matches: false,
      addEventListener: vi.fn((_, cb) => listeners.push(cb)),
      removeEventListener: vi.fn(),
    };
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn(() => mockMedia as any) as any;

    const { result } = renderHook(() => useMediaQuery('(max-width: 800px)'));
    expect(result.current).toBe(false);

    act(() => {
      mockMedia.matches = true;
      listeners.forEach((cb) => cb());
    });

    expect(result.current).toBe(true);

    window.matchMedia = originalMatchMedia;
  });
});


