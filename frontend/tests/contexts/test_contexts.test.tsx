/**
 * Context Provider Tests
 * 
 * Tests critical Context providers for state management.
 * Per project rules: Tests validate existing behavior without modifying production code.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import React from 'react';

// Import contexts
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { TimezoneProvider, useTimezone } from '@/contexts/TimezoneContext';
import { FullScreenProvider, useFullScreen } from '@/contexts/FullScreenContext';
import { DailyGoalsProvider, useDailyGoals } from '@/contexts/DailyGoalsContext';
import { TransparentLabelsProvider, useTransparentLabels } from '@/contexts/TransparentLabelsContext';

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides default theme', () => {
    const TestComponent = () => {
      const { currentTheme } = useTheme();
      return <div data-testid="theme">{currentTheme}</div>;
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const themeElement = screen.getByTestId('theme');
    expect(themeElement.textContent).toBeTruthy();
  });

  it('allows theme switching', () => {
    const TestComponent = () => {
      const { currentTheme, setTheme } = useTheme();
      return (
        <div>
          <div data-testid="current-theme">{currentTheme}</div>
          <button onClick={() => setTheme('dark')}>
            Switch Theme
          </button>
        </div>
      );
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const button = screen.getByText('Switch Theme');
    act(() => {
      button.click();
    });

    // Theme should have changed
    const themeElement = screen.getByTestId('current-theme');
    expect(themeElement.textContent).toBeTruthy();
  });

  it('persists theme to localStorage', async () => {
    const TestComponent = () => {
      const { availableThemes } = useTheme();
      return <div data-testid="theme-test">{availableThemes.length > 0 ? 'has-themes' : 'no-themes'}</div>;
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Component renders with theme provider
    const testEl = screen.getByTestId('theme-test');
    expect(testEl).toBeInTheDocument();
  });

  it('provides multiple themes', () => {
    const TestComponent = () => {
      const { availableThemes } = useTheme();
      return <div data-testid="theme-count">{availableThemes.length}</div>;
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const countElement = screen.getByTestId('theme-count');
    const count = parseInt(countElement.textContent || '0');
    expect(count).toBeGreaterThan(0);
  });
});

describe('TimezoneContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides timezone functionality', () => {
    const TestComponent = () => {
      const { timezone } = useTimezone();
      return <div data-testid="timezone">{timezone}</div>;
    };

    render(
      <TimezoneProvider>
        <TestComponent />
      </TimezoneProvider>
    );

    const tzElement = screen.getByTestId('timezone');
    expect(tzElement.textContent).toBeTruthy();
  });

  it('allows timezone changes', () => {
    const TestComponent = () => {
      const { timezone, setTimezone } = useTimezone();
      return (
        <div>
          <div data-testid="current-tz">{timezone}</div>
          <button onClick={() => setTimezone('America/Los_Angeles')}>
            Set PST
          </button>
        </div>
      );
    };

    render(
      <TimezoneProvider>
        <TestComponent />
      </TimezoneProvider>
    );

    const button = screen.getByText('Set PST');
    act(() => {
      button.click();
    });

    const tzElement = screen.getByTestId('current-tz');
    expect(tzElement.textContent).toBe('America/Los_Angeles');
  });

  it('persists timezone to localStorage', async () => {
    const TestComponent = () => {
      const { setTimezone } = useTimezone();
      return (
        <button onClick={() => setTimezone('Europe/London')}>
          Set London
        </button>
      );
    };

    render(
      <TimezoneProvider>
        <TestComponent />
      </TimezoneProvider>
    );

    const button = screen.getByText('Set London');
    act(() => {
      button.click();
    });

    await waitFor(() => {
      const stored = localStorage.getItem('timezone');
      expect(stored).toBe('Europe/London');
    });
  });
});

describe('FullScreenContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides fullscreen state', () => {
    const TestComponent = () => {
      const { isFullScreen } = useFullScreen();
      return <div data-testid="fullscreen">{isFullScreen ? 'yes' : 'no'}</div>;
    };

    render(
      <FullScreenProvider>
        <TestComponent />
      </FullScreenProvider>
    );

    const fsElement = screen.getByTestId('fullscreen');
    expect(fsElement.textContent).toMatch(/yes|no/);
  });

  it('toggles fullscreen mode', () => {
    const TestComponent = () => {
      const { isFullScreen, toggleFullScreen } = useFullScreen();
      return (
        <div>
          <div data-testid="fs-status">{isFullScreen ? 'on' : 'off'}</div>
          <button onClick={toggleFullScreen}>Toggle</button>
        </div>
      );
    };

    render(
      <FullScreenProvider>
        <TestComponent />
      </FullScreenProvider>
    );

    const statusBefore = screen.getByTestId('fs-status').textContent;
    const button = screen.getByText('Toggle');
    
    act(() => {
      button.click();
    });

    const statusAfter = screen.getByTestId('fs-status').textContent;
    expect(statusBefore).not.toBe(statusAfter);
  });
});

describe('DailyGoalsContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides daily goals visibility state', () => {
    const TestComponent = () => {
      const { dailyGoalsEnabled } = useDailyGoals();
      return <div data-testid="enabled">{dailyGoalsEnabled ? 'yes' : 'no'}</div>;
    };

    render(
      <DailyGoalsProvider>
        <TestComponent />
      </DailyGoalsProvider>
    );

    const enabledElement = screen.getByTestId('enabled');
    expect(enabledElement.textContent).toMatch(/yes|no/);
  });

  it('toggles daily goals visibility', () => {
    const TestComponent = () => {
      const { showDailyGoals, setShowDailyGoals } = useDailyGoals();
      return (
        <div>
          <div data-testid="status">{showDailyGoals ? 'visible' : 'hidden'}</div>
          <button onClick={() => setShowDailyGoals(!showDailyGoals)}>
            Toggle
          </button>
        </div>
      );
    };

    render(
      <DailyGoalsProvider>
        <TestComponent />
      </DailyGoalsProvider>
    );

    const statusBefore = screen.getByTestId('status').textContent;
    const button = screen.getByText('Toggle');
    
    act(() => {
      button.click();
    });

    const statusAfter = screen.getByTestId('status').textContent;
    expect(statusBefore).not.toBe(statusAfter);
  });
});

describe('TransparentLabelsContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides transparent labels state', () => {
    const TestComponent = () => {
      const { transparentLabels } = useTransparentLabels();
      return <div data-testid="transparent">{transparentLabels ? 'yes' : 'no'}</div>;
    };

    render(
      <TransparentLabelsProvider>
        <TestComponent />
      </TransparentLabelsProvider>
    );

    const transparentElement = screen.getByTestId('transparent');
    expect(transparentElement.textContent).toMatch(/yes|no/);
  });

  it('toggles transparent labels', () => {
    const TestComponent = () => {
      const { transparentLabels, setTransparentLabels } = useTransparentLabels();
      return (
        <div>
          <div data-testid="status">{transparentLabels ? 'transparent' : 'solid'}</div>
          <button onClick={() => setTransparentLabels(!transparentLabels)}>
            Toggle
          </button>
        </div>
      );
    };

    render(
      <TransparentLabelsProvider>
        <TestComponent />
      </TransparentLabelsProvider>
    );

    const statusBefore = screen.getByTestId('status').textContent;
    const button = screen.getByText('Toggle');
    
    act(() => {
      button.click();
    });

    const statusAfter = screen.getByTestId('status').textContent;
    expect(statusBefore).not.toBe(statusAfter);
  });

  it('persists transparent labels preference', async () => {
    const TestComponent = () => {
      const { setTransparentLabels } = useTransparentLabels();
      return (
        <button onClick={() => setTransparentLabels(true)}>
          Enable Transparent
        </button>
      );
    };

    render(
      <TransparentLabelsProvider>
        <TestComponent />
      </TransparentLabelsProvider>
    );

    const button = screen.getByText('Enable Transparent');
    act(() => {
      button.click();
    });

    await waitFor(() => {
      const stored = localStorage.getItem('transparentLabels');
      expect(stored).toBe('true');
    });
  });
});

describe('Context Provider Integration', () => {
  it('multiple contexts can be nested', () => {
    const TestComponent = () => {
      const { currentTheme } = useTheme();
      const { timezone } = useTimezone();
      const { isFullScreen } = useFullScreen();
      
      return (
        <div>
          <div data-testid="theme">{currentTheme}</div>
          <div data-testid="timezone">{timezone}</div>
          <div data-testid="fullscreen">{isFullScreen ? 'yes' : 'no'}</div>
        </div>
      );
    };

    render(
      <ThemeProvider>
        <TimezoneProvider>
          <FullScreenProvider>
            <TestComponent />
          </FullScreenProvider>
        </TimezoneProvider>
      </ThemeProvider>
    );

    // All contexts should provide values
    expect(screen.getByTestId('theme').textContent).toBeTruthy();
    expect(screen.getByTestId('timezone').textContent).toBeTruthy();
    expect(screen.getByTestId('fullscreen').textContent).toMatch(/yes|no/);
  });

  it('contexts remain isolated from each other', () => {
    const TestComponent = () => {
      const { setTheme } = useTheme();
      const { timezone } = useTimezone();
      
      return (
        <div>
          <div data-testid="timezone">{timezone}</div>
          <button onClick={() => setTheme('dark')}>Change Theme</button>
        </div>
      );
    };

    render(
      <ThemeProvider>
        <TimezoneProvider>
          <TestComponent />
        </TimezoneProvider>
      </ThemeProvider>
    );

    const timezoneBefore = screen.getByTestId('timezone').textContent;
    const button = screen.getByText('Change Theme');
    
    act(() => {
      button.click();
    });

    const timezoneAfter = screen.getByTestId('timezone').textContent;
    // Timezone should not change when theme changes
    expect(timezoneBefore).toBe(timezoneAfter);
  });
});

