/**
 * EmojiPicker Component Tests
 *
 * Tests for the EmojiPicker component with custom emojis and selection.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CustomEmoji } from '@/types';

// Create hoisted mocks first
const mockCustomEmojisApi = vi.hoisted(() => ({
  getAll: vi.fn(),
}));

const mockUseEmojiLibrary = vi.hoisted(() => vi.fn());

// Unmock the EmojiPicker (it's mocked globally in vitest.setup.ts)
vi.unmock('@/components/EmojiPicker');

vi.mock('@/api', () => ({
  __esModule: true,
  customEmojisApi: mockCustomEmojisApi,
}));

vi.mock('@/contexts/EmojiLibraryContext', () => ({
  useEmojiLibrary: mockUseEmojiLibrary,
}));

// Mock third-party emoji picker
vi.mock('emoji-picker-react', () => ({
  default: ({ onEmojiClick }: { onEmojiClick: (data: any) => void }) => (
    <div data-testid="emoji-picker-mock">
      <button
        data-testid="emoji-smiley"
        onClick={() => onEmojiClick({ emoji: '😀' })}
      >
        😀
      </button>
    </div>
  ),
}));

vi.mock('@emoji-mart/react', () => ({
  default: () => <div data-testid="emoji-mart-mock" />,
}));

vi.mock('@emoji-mart/data', () => ({
  default: {},
}));

vi.mock('@/components/CustomEmojiManager', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="custom-emoji-manager">
        <button onClick={onClose}>Close Manager</button>
      </div>
    ) : null,
}));

// Import the component after mocks are set up
import EmojiPicker from '@/components/EmojiPicker';

const buildCustomEmoji = (id: number, name: string): CustomEmoji => ({
  id,
  name,
  image_url: `/api/uploads/emojis/${name}.png`,
  created_at: '2025-11-07T12:00:00Z',
  is_animated: false,
});

describe('EmojiPicker', () => {
  const onEmojiSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCustomEmojisApi.getAll.mockResolvedValue([]);
    mockUseEmojiLibrary.mockReturnValue({
      emojiLibrary: 'emoji-picker-react',
      isLoading: false,
    });
  });

  const renderPicker = (props: Partial<Parameters<typeof EmojiPicker>[0]> = {}) =>
    render(<EmojiPicker onEmojiSelect={onEmojiSelect} {...props} />);

  describe('Rendering', () => {
    it('renders the emoji picker button', () => {
      renderPicker();

      expect(screen.getByTitle('Pick emoji')).toBeInTheDocument();
    });

    it('picker is closed by default', () => {
      renderPicker();

      expect(screen.queryByText('Pick an emoji')).not.toBeInTheDocument();
    });

    it('opens picker when button is clicked', async () => {
      renderPicker();

      fireEvent.click(screen.getByTitle('Pick emoji'));

      await waitFor(() => {
        expect(screen.getByText('Pick an emoji')).toBeInTheDocument();
      });
    });
  });

  describe('Emoji Selection', () => {
    it('calls onEmojiSelect with emoji when clicked', async () => {
      renderPicker();

      fireEvent.click(screen.getByTitle('Pick emoji'));
      await waitFor(() => {
        expect(screen.getByTestId('emoji-picker-mock')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('emoji-smiley'));

      expect(onEmojiSelect).toHaveBeenCalledWith('😀', false);
    });

    it('closes picker after emoji selection', async () => {
      renderPicker();

      fireEvent.click(screen.getByTitle('Pick emoji'));
      await waitFor(() => {
        expect(screen.getByText('Pick an emoji')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('emoji-smiley'));

      await waitFor(() => {
        expect(screen.queryByText('Pick an emoji')).not.toBeInTheDocument();
      });
    });
  });

  describe('Custom Emojis', () => {
    it('loads custom emojis when picker opens', async () => {
      mockCustomEmojisApi.getAll.mockResolvedValue([
        buildCustomEmoji(1, 'custom1'),
      ]);

      renderPicker();

      fireEvent.click(screen.getByTitle('Pick emoji'));

      await waitFor(() => {
        expect(mockCustomEmojisApi.getAll).toHaveBeenCalledWith(false);
      });
    });

    it('displays custom emojis section when emojis exist', async () => {
      mockCustomEmojisApi.getAll.mockResolvedValue([buildCustomEmoji(1, 'myemoji')]);

      renderPicker();

      fireEvent.click(screen.getByTitle('Pick emoji'));

      await waitFor(() => {
        expect(screen.getByText('Custom Emojis')).toBeInTheDocument();
      });
    });

    it('calls onEmojiSelect with custom emoji data', async () => {
      const customEmoji = buildCustomEmoji(1, 'party');
      mockCustomEmojisApi.getAll.mockResolvedValue([customEmoji]);

      renderPicker();

      fireEvent.click(screen.getByTitle('Pick emoji'));

      await waitFor(() => {
        expect(screen.getByTitle(':party:')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle(':party:'));

      expect(onEmojiSelect).toHaveBeenCalledWith(
        'party',
        true,
        '/api/uploads/emojis/party.png'
      );
    });

    it('does not show custom section when no custom emojis', async () => {
      mockCustomEmojisApi.getAll.mockResolvedValue([]);

      renderPicker();

      fireEvent.click(screen.getByTitle('Pick emoji'));

      await waitFor(() => {
        expect(screen.getByText('Pick an emoji')).toBeInTheDocument();
      });

      expect(screen.queryByText('Custom Emojis')).not.toBeInTheDocument();
    });
  });

  describe('Custom Emoji Manager', () => {
    it('opens custom emoji manager when settings button clicked', async () => {
      renderPicker();

      fireEvent.click(screen.getByTitle('Pick emoji'));
      await waitFor(() => {
        expect(screen.getByTitle('Manage custom emojis')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Manage custom emojis'));

      await waitFor(() => {
        expect(screen.getByTestId('custom-emoji-manager')).toBeInTheDocument();
      });
    });
  });

  describe('Button Variants', () => {
    it('applies accent variant styles when specified', () => {
      renderPicker({ variant: 'accent' });

      const button = screen.getByTitle('Pick emoji');
      expect(button).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });
  });

  describe('Loading State', () => {
    it('shows disabled button when loading', () => {
      mockUseEmojiLibrary.mockReturnValue({
        emojiLibrary: 'emoji-picker-react',
        isLoading: true,
      });

      renderPicker();

      const button = screen.getByTitle('Loading emoji picker...');
      expect(button).toBeDisabled();
    });
  });
});
