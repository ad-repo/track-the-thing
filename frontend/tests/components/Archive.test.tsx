/**
 * Archive Component Tests
 *
 * Tests for the Archive page showing archived lists and cards with restore functionality.
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
  formatTimestamp: (date: string) => 'Nov 7, 2025',
}));

const buildArchivedList = (id: number, overrides: Partial<ListWithEntries> = {}): ListWithEntries => ({
  id,
  name: `Archived List ${id}`,
  description: `Description for list ${id}`,
  color: '#3b82f6',
  order_index: id - 1,
  is_archived: true,
  entries: [],
  is_kanban: false,
  kanban_order: 0,
  created_at: '2025-11-07T12:00:00Z',
  updated_at: '2025-11-07T12:00:00Z',
  labels: [],
  ...overrides,
});

const buildArchivedEntry = (id: number, overrides: Partial<NoteEntry> = {}): NoteEntry => ({
  id,
  daily_note_id: 1,
  title: `Archived Entry ${id}`,
  content: `<p>Content for entry ${id}</p>`,
  content_type: 'rich_text',
  order_index: id - 1,
  created_at: '2025-11-07T12:00:00Z',
  updated_at: '2025-11-07T12:00:00Z',
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

  describe('Loading and Empty States', () => {
    it('shows loading state initially', () => {
      // Make API hang to see loading state
      mockListsApi.getArchived.mockImplementation(() => new Promise(() => {}));
      mockEntriesApi.getArchived.mockImplementation(() => new Promise(() => {}));

      renderArchive();

      expect(screen.getByText('Loading archive...')).toBeInTheDocument();
    });

    it('shows empty state when no archived items', async () => {
      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('No archived items')).toBeInTheDocument();
      });
      expect(screen.getByText('Items you archive will appear here')).toBeInTheDocument();
    });

    it('shows error state and retry button on API failure', async () => {
      mockListsApi.getArchived.mockRejectedValue(new Error('Network error'));
      mockEntriesApi.getArchived.mockRejectedValue(new Error('Network error'));

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Failed to load archived items')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('retries loading when retry button clicked', async () => {
      mockListsApi.getArchived.mockRejectedValueOnce(new Error('Network error'));
      mockEntriesApi.getArchived.mockRejectedValueOnce(new Error('Network error'));

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Failed to load archived items')).toBeInTheDocument();
      });

      // Setup success for retry
      mockListsApi.getArchived.mockResolvedValue([]);
      mockEntriesApi.getArchived.mockResolvedValue([]);

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText('No archived items')).toBeInTheDocument();
      });
    });
  });

  describe('Displaying Archived Items', () => {
    it('displays archived lists', async () => {
      mockListsApi.getArchived.mockResolvedValue([
        buildArchivedList(1, { name: 'Backlog' }),
        buildArchivedList(2, { name: 'Done Tasks' }),
      ]);

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Backlog')).toBeInTheDocument();
      });
      expect(screen.getByText('Done Tasks')).toBeInTheDocument();
      expect(screen.getByText('Archived Lists')).toBeInTheDocument();
    });

    it('displays archived cards', async () => {
      mockEntriesApi.getArchived.mockResolvedValue([
        buildArchivedEntry(1, { title: 'Old Task' }),
        buildArchivedEntry(2, { title: 'Completed Item' }),
      ]);

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Old Task')).toBeInTheDocument();
      });
      expect(screen.getByText('Completed Item')).toBeInTheDocument();
      expect(screen.getByText('Archived Cards')).toBeInTheDocument();
    });

    it('displays counts in tabs', async () => {
      mockListsApi.getArchived.mockResolvedValue([buildArchivedList(1), buildArchivedList(2)]);
      mockEntriesApi.getArchived.mockResolvedValue([buildArchivedEntry(1)]);

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument(); // All count
      });
      expect(screen.getByText('2')).toBeInTheDocument(); // Lists count
      expect(screen.getByText('1')).toBeInTheDocument(); // Cards count
    });
  });

  describe('Tab Filtering', () => {
    beforeEach(() => {
      mockListsApi.getArchived.mockResolvedValue([buildArchivedList(1, { name: 'Test List' })]);
      mockEntriesApi.getArchived.mockResolvedValue([buildArchivedEntry(1, { title: 'Test Card' })]);
    });

    it('shows all items by default (All tab)', async () => {
      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Test List')).toBeInTheDocument();
      });
      expect(screen.getByText('Test Card')).toBeInTheDocument();
    });

    it('filters to show only lists when Lists tab clicked', async () => {
      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Test List')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /lists/i }));

      expect(screen.getByText('Test List')).toBeInTheDocument();
      expect(screen.queryByText('Test Card')).not.toBeInTheDocument();
    });

    it('filters to show only cards when Cards tab clicked', async () => {
      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Test Card')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /cards/i }));

      expect(screen.getByText('Test Card')).toBeInTheDocument();
      expect(screen.queryByText('Test List')).not.toBeInTheDocument();
    });
  });

  describe('Restore Functionality', () => {
    it('restores a list when restore button clicked', async () => {
      mockListsApi.getArchived.mockResolvedValue([buildArchivedList(1, { name: 'Restore Me' })]);
      mockListsApi.update.mockResolvedValue({});

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Restore Me')).toBeInTheDocument();
      });

      const restoreButton = screen.getByTitle('Restore list');
      fireEvent.click(restoreButton);

      await waitFor(() => {
        expect(mockListsApi.update).toHaveBeenCalledWith(1, { is_archived: false });
      });
    });

    it('restores an entry when restore button clicked', async () => {
      mockEntriesApi.getArchived.mockResolvedValue([buildArchivedEntry(1, { title: 'Restore Card' })]);
      mockEntriesApi.toggleArchive.mockResolvedValue({});

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Restore Card')).toBeInTheDocument();
      });

      const restoreButton = screen.getByTitle('Restore card');
      fireEvent.click(restoreButton);

      await waitFor(() => {
        expect(mockEntriesApi.toggleArchive).toHaveBeenCalledWith(1);
      });
    });

    it('reloads archived items after restore', async () => {
      mockListsApi.getArchived.mockResolvedValueOnce([buildArchivedList(1)]);
      mockListsApi.update.mockResolvedValue({});
      mockListsApi.getArchived.mockResolvedValueOnce([]); // Empty after restore

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('Archived List 1')).toBeInTheDocument();
      });

      const restoreButton = screen.getByTitle('Restore list');
      fireEvent.click(restoreButton);

      await waitFor(() => {
        expect(mockListsApi.getArchived).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('View Mode Toggle', () => {
    beforeEach(() => {
      mockListsApi.getArchived.mockResolvedValue([buildArchivedList(1)]);
      mockEntriesApi.getArchived.mockResolvedValue([buildArchivedEntry(1)]);
    });

    it('defaults to list view', async () => {
      renderArchive();

      await waitFor(() => {
        expect(screen.getByTitle('List view')).toBeInTheDocument();
      });
    });

    it('switches to preview view when preview button clicked', async () => {
      renderArchive();

      await waitFor(() => {
        expect(screen.getByTitle('Preview view')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Preview view'));

      // View mode should change (stored in localStorage)
      expect(localStorage.getItem('archive-view-mode')).toBe('preview');
    });

    it('persists view mode preference in localStorage', async () => {
      localStorage.setItem('archive-view-mode', 'preview');

      renderArchive();

      await waitFor(() => {
        expect(localStorage.getItem('archive-view-mode')).toBe('preview');
      });
    });
  });

  describe('List with Entries Preview', () => {
    it('shows entry count for archived lists', async () => {
      mockListsApi.getArchived.mockResolvedValue([
        buildArchivedList(1, {
          name: 'List with Cards',
          entries: [buildArchivedEntry(1), buildArchivedEntry(2), buildArchivedEntry(3)],
        }),
      ]);

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('List with Cards')).toBeInTheDocument();
      });
      expect(screen.getByText('3 cards')).toBeInTheDocument();
    });

    it('shows labels on archived entries', async () => {
      mockEntriesApi.getArchived.mockResolvedValue([
        buildArchivedEntry(1, {
          title: 'Labeled Card',
          labels: [{ id: 1, name: 'urgent', color: '#ef4444', created_at: '' }],
        }),
      ]);

      renderArchive();

      await waitFor(() => {
        expect(screen.getByText('urgent')).toBeInTheDocument();
      });
    });
  });
});
