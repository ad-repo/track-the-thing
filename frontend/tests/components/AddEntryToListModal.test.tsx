import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddEntryToListModal from '@/components/AddEntryToListModal';
import type { List, NoteEntry } from '@/types';

const mockNotesApi = vi.hoisted(() => ({
  getAll: vi.fn(),
}));

const mockListsApi = vi.hoisted(() => ({
  addEntry: vi.fn(),
}));

vi.mock('@/api', () => ({
  __esModule: true,
  notesApi: mockNotesApi,
  listsApi: mockListsApi,
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

vi.mock('@/contexts/TimezoneContext', () => ({
  useTimezone: () => ({ timezone: 'UTC' }),
}));

vi.mock('@/utils/timezone', () => ({
  formatTimestamp: (value: string) => `formatted-${value}`,
}));

const buildEntry = (id: number): NoteEntry => ({
  id,
  daily_note_id: 1,
  title: `Entry ${id}`,
  content: `<p>Content ${id}</p>`,
  content_type: 'rich_text',
  order_index: id,
  created_at: '2025-11-07T09:00:00Z',
  updated_at: '2025-11-07T09:00:00Z',
  labels: [],
  include_in_report: false,
  is_important: false,
  is_completed: false,
  is_pinned: false,
});

const mockList: List = {
  id: 1,
  name: 'Inbox',
  description: '',
  color: '#3b82f6',
  order_index: 0,
  is_archived: false,
  created_at: '',
  updated_at: '',
};

describe('AddEntryToListModal', () => {
  const onClose = vi.fn();
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotesApi.getAll.mockResolvedValue([{ id: 1, date: '2025-11-07', entries: [buildEntry(1), buildEntry(2)] }]);
    mockListsApi.addEntry.mockResolvedValue(undefined);
  });

  const renderModal = () =>
    render(<AddEntryToListModal list={mockList} onClose={onClose} onUpdate={onUpdate} />);

  it('loads entries and adds a card to the list', async () => {
    renderModal();

    const addButtons = await screen.findAllByRole('button', { name: /add/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => expect(mockListsApi.addEntry).toHaveBeenCalledWith(1, 1));
    expect(onUpdate).toHaveBeenCalled();
  });

  it('filters entries based on the search input', async () => {
    renderModal();
    await screen.findByText('Entry 1');

    const input = screen.getByPlaceholderText(/search entries/i);
    fireEvent.change(input, { target: { value: 'missing' } });

    await screen.findByText(/no entries found matching your search/i);
  });

  it('closes when Escape is pressed', async () => {
    renderModal();
    await screen.findByText('Entry 1');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});

