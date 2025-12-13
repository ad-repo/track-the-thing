/**
 * DayLabelsContext Tests
 *
 * Tests for the DayLabelsContext providing day label visibility state.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DayLabelsProvider, useDayLabels } from '@/contexts/DayLabelsContext';

// Test component to access context values
const TestConsumer = () => {
  const { showDayLabels, setShowDayLabels } = useDayLabels();
  return (
    <div>
      <span data-testid="show-day-labels">{showDayLabels.toString()}</span>
      <button onClick={() => setShowDayLabels(true)}>Show</button>
      <button onClick={() => setShowDayLabels(false)}>Hide</button>
    </div>
  );
};

describe('DayLabelsContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('DayLabelsProvider', () => {
    it('defaults to showing day labels when no localStorage value', () => {
      render(
        <DayLabelsProvider>
          <TestConsumer />
        </DayLabelsProvider>
      );

      expect(screen.getByTestId('show-day-labels')).toHaveTextContent('true');
    });

    it('reads initial value from localStorage', () => {
      localStorage.setItem('showDayLabels', 'false');

      render(
        <DayLabelsProvider>
          <TestConsumer />
        </DayLabelsProvider>
      );

      expect(screen.getByTestId('show-day-labels')).toHaveTextContent('false');
    });

    it('updates state when setShowDayLabels is called', () => {
      render(
        <DayLabelsProvider>
          <TestConsumer />
        </DayLabelsProvider>
      );

      expect(screen.getByTestId('show-day-labels')).toHaveTextContent('true');

      fireEvent.click(screen.getByText('Hide'));

      expect(screen.getByTestId('show-day-labels')).toHaveTextContent('false');
    });

    it('persists value to localStorage when changed', () => {
      render(
        <DayLabelsProvider>
          <TestConsumer />
        </DayLabelsProvider>
      );

      fireEvent.click(screen.getByText('Hide'));

      expect(localStorage.getItem('showDayLabels')).toBe('false');
    });

    it('can toggle value back to true', () => {
      localStorage.setItem('showDayLabels', 'false');

      render(
        <DayLabelsProvider>
          <TestConsumer />
        </DayLabelsProvider>
      );

      expect(screen.getByTestId('show-day-labels')).toHaveTextContent('false');

      fireEvent.click(screen.getByText('Show'));

      expect(screen.getByTestId('show-day-labels')).toHaveTextContent('true');
      expect(localStorage.getItem('showDayLabels')).toBe('true');
    });
  });

  describe('useDayLabels', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useDayLabels must be used within a DayLabelsProvider');

      consoleSpy.mockRestore();
    });
  });
});

