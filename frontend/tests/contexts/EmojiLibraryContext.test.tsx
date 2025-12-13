/**
 * EmojiLibraryContext Tests
 *
 * Tests for the EmojiLibraryContext providing emoji library preference.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mock for axios
const mockAxios = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
}));

// Unmock the context (it's mocked globally in vitest.setup.ts)
vi.unmock('@/contexts/EmojiLibraryContext');

vi.mock('axios', () => ({
  __esModule: true,
  default: mockAxios,
}));

// Import context after mock setup
import { EmojiLibraryProvider, useEmojiLibrary } from '@/contexts/EmojiLibraryContext';

// Test component to access context values
const TestConsumer = () => {
  const context = useEmojiLibrary();
  
  const handleSetEmojiMart = async () => {
    try {
      await context.setEmojiLibrary('emoji-mart');
    } catch {
      // Error handled by context
    }
  };
  
  const handleSetEmojiPickerReact = async () => {
    try {
      await context.setEmojiLibrary('emoji-picker-react');
    } catch {
      // Error handled by context
    }
  };
  
  return (
    <div>
      <span data-testid="emoji-library">{context.emojiLibrary}</span>
      <span data-testid="is-loading">{String(context.isLoading)}</span>
      <button onClick={handleSetEmojiMart}>Use Emoji Mart</button>
      <button onClick={handleSetEmojiPickerReact}>Use Emoji Picker React</button>
    </div>
  );
};

describe('EmojiLibraryContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockAxios.get.mockResolvedValue({ data: { emoji_library: 'emoji-picker-react' } });
    mockAxios.patch.mockResolvedValue({ data: {} });
  });

  describe('EmojiLibraryProvider', () => {
    it('loads emoji library preference from API on mount', async () => {
      mockAxios.get.mockResolvedValue({ data: { emoji_library: 'emoji-mart' } });

      render(
        <EmojiLibraryProvider>
          <TestConsumer />
        </EmojiLibraryProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('emoji-library')).toHaveTextContent('emoji-mart');
      expect(mockAxios.get).toHaveBeenCalled();
    });

    it('defaults to emoji-picker-react when no preference set', async () => {
      mockAxios.get.mockResolvedValue({ data: {} });

      render(
        <EmojiLibraryProvider>
          <TestConsumer />
        </EmojiLibraryProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('emoji-library')).toHaveTextContent('emoji-picker-react');
    });

    it('falls back to localStorage when API fails', async () => {
      localStorage.setItem('emojiLibrary', 'emoji-mart');
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      render(
        <EmojiLibraryProvider>
          <TestConsumer />
        </EmojiLibraryProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('emoji-library')).toHaveTextContent('emoji-mart');
    });

    it('stores preference in localStorage when loaded from API', async () => {
      mockAxios.get.mockResolvedValue({ data: { emoji_library: 'emoji-mart' } });

      render(
        <EmojiLibraryProvider>
          <TestConsumer />
        </EmojiLibraryProvider>
      );

      await waitFor(() => {
        expect(localStorage.getItem('emojiLibrary')).toBe('emoji-mart');
      });
    });

    it('shows loading state initially', () => {
      // Don't resolve the API call immediately
      mockAxios.get.mockImplementation(() => new Promise(() => {}));

      render(
        <EmojiLibraryProvider>
          <TestConsumer />
        </EmojiLibraryProvider>
      );

      expect(screen.getByTestId('is-loading')).toHaveTextContent('true');
    });
  });

  describe('setEmojiLibrary', () => {
    it('updates emoji library via API', async () => {
      render(
        <EmojiLibraryProvider>
          <TestConsumer />
        </EmojiLibraryProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Use Emoji Mart'));
      });

      await waitFor(() => {
        expect(mockAxios.patch).toHaveBeenCalledWith(
          expect.stringContaining('/api/settings'),
          { emoji_library: 'emoji-mart' }
        );
      });
    });

    it('updates state after successful API call', async () => {
      render(
        <EmojiLibraryProvider>
          <TestConsumer />
        </EmojiLibraryProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Use Emoji Mart'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('emoji-library')).toHaveTextContent('emoji-mart');
      });
    });

    it('updates localStorage after successful API call', async () => {
      render(
        <EmojiLibraryProvider>
          <TestConsumer />
        </EmojiLibraryProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Use Emoji Mart'));
      });

      await waitFor(() => {
        expect(localStorage.getItem('emojiLibrary')).toBe('emoji-mart');
      });
    });

    it('logs error when API call fails', async () => {
      const networkError = new Error('Network error');
      mockAxios.patch.mockRejectedValue(networkError);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <EmojiLibraryProvider>
          <TestConsumer />
        </EmojiLibraryProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      // Click the button and wait for the error to be logged
      await act(async () => {
        fireEvent.click(screen.getByText('Use Emoji Mart'));
        // Give time for the async operation to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('useEmojiLibrary', () => {
    it('throws error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useEmojiLibrary must be used within an EmojiLibraryProvider');

      consoleSpy.mockRestore();
    });
  });
});

