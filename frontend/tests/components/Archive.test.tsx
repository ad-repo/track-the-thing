/**
 * Archive Component Tests
 *
 * Tests for Archive page including:
 * - Loading archived lists and entries
 * - Tab navigation (all, lists, cards)
 * - View mode toggle (list/preview)
 * - Restore functionality
 * - Empty/error states
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Archive from '@/components/Archive';
import { renderWithRouter } from '../test-utils';
import type { ListWithEntries, NoteEntry } from '@/types';

const mockListsApi = vi.hoisted(() => ({
  getArchived: vi.fn(),
  update: vi.fn(),
}));

const mockEntriesApi = vi.hoisted(() => ({
  getArchived: vi.fn(),
  toggleArchive: vi.fn(),
}));

vi.mock('@/api', () => ({
  __esModule: true,
  listsApi: mockListsApi,
  entriesApi: mockEntriesApi,
}));

vi.mock('@/contexts/TimezoneContext', () => ({
  useTimezone: () => ({ timezone: 'UTC' }),
}));

vi.mock('@/utils/timezone', () => ({
  formatTimestamp: (date: string) => 'Jan 1, 2025',
}));

const buildList = (id: number, overrides: Partial<ListWithEntries> = {}): ListWithEntries => ({
  id,
  name: `Archived List ${id}`,
  description: `Description for list ${id}`,
  color: '#3b82f6',
  order_index: id - 1,
  is_archived: true,
  entries: [],
  is_kanban: false,
  kanban_order: 0,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  labels: [],
  ...overrides,
});

const buildEntry = (id: number, overrides: Partial<NoteEntry> = {}): NoteEntry => ({
  id,
  daily_note_id: 1,
  title: `Archived Entry ${id}`,
  content: `<p>Content for entry ${id}</p>`,
  content_type: 'rich_text',
  order_index: id - 1,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  labels: [],
  include_in_report: false,
  is_important: false,
  is_completed: false,
  is_pinned: false,
  is_archived: true,
  ...overrides,
});

describe('Archive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockListsApi.getArchived.mockResolvedValue([]);
    mockEntriesApi.getArchived.mockResolvedValue([]);
  });

  const renderArchive = () => renderWithRouter(<Archive />);

  describe('Loading State', () => {
    it('shows loading indicator while fetching data', async () => {
      // Make API calls hang
      mockListsApi.getArchived.mockImplementation(() => new Promise(() => {}));
      mockEntriesApi.getArchived.mockImplementation(() => new Promise(() => {}));

      renderArchive();

      expect(screen.getByText('Loading archive...')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no archived items exist', async () => {
      mockListsApi.getArchived.mockResolvedValue([]);
      mockEntriesApi.getArchived.mockResolvedValue([]);

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('No archived items')).toBeInTheDocument();
      });
      expect(screen.getByText('Items you archive will appear here')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message and retry button on API failure', async () => {
      mockListsApi.getArchived.mockRejectedValue(new Error('Network error'));

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Failed to load archived items')).toBeInTheDocument();
      });
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('retries loading when retry button is clicked', async () => {
      mockListsApi.getArchived.mockRejectedValueOnce(new Error('Network error'));
      mockListsApi.getArchived.mockResolvedValueOnce([buildList(1)]);
      mockEntriesApi.getArchived.mockResolvedValue([]);

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('Archived List 1')).toBeInTheDocument();
      });
    });
  });

  describe('Archived Lists', () => {
    it('displays archived lists', async () => {
      mockListsApi.getArchived.mockResolvedValue([buildList(1), buildList(2)]);
      mockEntriesApi.getArchived.mockResolvedValue([]);

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Archived List 1')).toBeInTheDocument();
      });
      expect(screen.getByText('Archived List 2')).toBeInTheDocument();
      expect(screen.getByText('Archived Lists')).toBeInTheDocument();
    });

    it('displays list description', async () => {
      mockListsApi.getArchived.mockResolvedValue([buildList(1, { description: 'Test description' })]);
      mockEntriesApi.getArchived.mockResolvedValue([]);

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Test description')).toBeInTheDocument();
      });
    });

    it('shows list color indicator', async () => {
      mockListsApi.getArchived.mockResolvedValue([buildList(1, { color: '#ff0000' })]);
      mockEntriesApi.getArchived.mockResolvedValue([]);

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Archived List 1')).toBeInTheDocument();
      });
    });
  });

  describe('Archived Entries', () => {
    it('displays archived entries', async () => {
      mockListsApi.getArchived.mockResolvedValue([]);
      mockEntriesApi.getArchived.mockResolvedValue([buildEntry(1), buildEntry(2)]);

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Archived Entry 1')).toBeInTheDocument();
      });
      expect(screen.getByText('Archived Entry 2')).toBeInTheDocument();
      expect(screen.getByText('Archived Cards')).toBeInTheDocument();
    });

    it('displays entry labels', async () => {
      mockListsApi.getArchived.mockResolvedValue([]);
      mockEntriesApi.getArchived.mockResolvedValue([
        buildEntry(1, { labels: [{ id: 1, name: 'urgent', color: '#ef4444', created_at: '' }] }),
      ]);

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('urgent')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    beforeEach(() => {
      mockListsApi.getArchived.mockResolvedValue([buildList(1)]);
      mockEntriesApi.getArchived.mockResolvedValue([buildEntry(1)]);
    });

    it('shows all items by default (All tab)', async () => {
      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Archived Lists')).toBeInTheDocument();
      });
      expect(screen.getByText('Archived Cards')).toBeInTheDocument();
    });

    it('filters to only lists when Lists tab is clicked', async () => {
      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Archived Lists')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /lists/i }));

      expect(screen.getByText('Archived Lists')).toBeInTheDocument();
      expect(screen.queryByText('Archived Cards')).not.toBeInTheDocument();
    });

    it('filters to only cards when Cards tab is clicked', async () => {
      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Archived Cards')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /cards/i }));

      expect(screen.queryByText('Archived Lists')).not.toBeInTheDocument();
      expect(screen.getByText('Archived Cards')).toBeInTheDocument();
    });

    it('displays item counts in tabs', async () => {
      renderArchive();

      await waitFor(() => {
        // All tab shows total count (1 list + 1 entry = 2)
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('Restore Functionality', () => {
    it('restores a list when restore button is clicked', async () => {
      mockListsApi.getArchived.mockResolvedValue([buildList(1)]);
      mockEntriesApi.getArchived.mockResolvedValue([]);
      mockListsApi.update.mockResolvedValue({});

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Archived List 1')).toBeInTheDocument();
      });

      const restoreButton = screen.getByTitle('Restore list');
      fireEvent.click(restoreButton);

      await waitFor(() => {
        expect(mockListsApi.update).toHaveBeenCalledWith(1, { is_archived: false });
      });
    });

    it('restores an entry when restore button is clicked', async () => {
      mockListsApi.getArchived.mockResolvedValue([]);
      mockEntriesApi.getArchived.mockResolvedValue([buildEntry(1)]);
      mockEntriesApi.toggleArchive.mockResolvedValue({});

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Archived Entry 1')).toBeInTheDocument();
      });

      const restoreButton = screen.getByTitle('Restore card');
      fireEvent.click(restoreButton);

      await waitFor(() => {
        expect(mockEntriesApi.toggleArchive).toHaveBeenCalledWith(1);
      });
    });

    it('reloads archive after successful restore', async () => {
      mockListsApi.getArchived
        .mockResolvedValueOnce([buildList(1), buildList(2)])
        .mockResolvedValueOnce([buildList(2)]);
      mockEntriesApi.getArchived.mockResolvedValue([]);
      mockListsApi.update.mockResolvedValue({});

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Archived List 1')).toBeInTheDocument();
      });

      const restoreButtons = screen.getAllByTitle('Restore list');
      fireEvent.click(restoreButtons[0]);

      await waitFor(() => {
        expect(mockListsApi.getArchived).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('View Mode Toggle', () => {
    beforeEach(() => {
      mockListsApi.getArchived.mockResolvedValue([buildList(1)]);
      mockEntriesApi.getArchived.mockResolvedValue([buildEntry(1)]);
    });

    it('defaults to list view', async () => {
      renderArchive();

      await waitFor(() => {
        expect(screen.getByTitle('List view')).toBeInTheDocument();
      });
    });

    it('switches to preview view when toggle is clicked', async () => {
      renderArchive();

      await waitFor(() => {
        expect(screen.getByTitle('Preview view')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Preview view'));

      // View mode changed
      expect(localStorage.getItem('archive-view-mode')).toBe('preview');
    });

    it('persists view mode preference to localStorage', async () => {
      localStorage.setItem('archive-view-mode', 'preview');

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Archived List 1')).toBeInTheDocument();
      });

      expect(localStorage.getItem('archive-view-mode')).toBe('preview');
    });
  });

  describe('List with Entries Preview', () => {
    it('shows entry count in list card', async () => {
      const listWithEntries = buildList(1, {
        entries: [buildEntry(1), buildEntry(2), buildEntry(3)],
      });
      mockListsApi.getArchived.mockResolvedValue([listWithEntries]);
      mockEntriesApi.getArchived.mockResolvedValue([]);

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('3 cards')).toBeInTheDocument();
      });
    });
  });
});

