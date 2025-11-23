import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateEntryModal from '@/components/CreateEntryModal';
import type { List, NoteEntry } from '@/types';

const mockNotesApi = vi.hoisted(() => ({
  getByDate: vi.fn(),
  create: vi.fn(),
}));

const mockEntriesApi = vi.hoisted(() => ({
  create: vi.fn(),
  delete: vi.fn(),
}));

const mockListsApi = vi.hoisted(() => ({
  addEntry: vi.fn(),
}));

vi.mock('@/api', () => ({
  __esModule: true,
  notesApi: mockNotesApi,
  entriesApi: mockEntriesApi,
  listsApi: mockListsApi,
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

const mockEntry: NoteEntry = {
  id: 42,
  daily_note_id: 1,
  title: '',
  content: '',
  content_type: 'rich_text',
  order_index: 0,
  created_at: '2025-11-07T10:00:00Z',
  updated_at: '2025-11-07T10:00:00Z',
  labels: [],
  include_in_report: false,
  is_important: false,
  is_completed: false,
  is_pinned: false,
};

vi.mock('@/components/NoteEntryCard', () => ({
  __esModule: true,
  default: ({ onListsUpdate }: { onListsUpdate: () => void }) => (
    <div>
      <button onClick={onListsUpdate}>Save</button>
    </div>
  ),
}));

describe('CreateEntryModal', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const list: List = {
    id: 9,
    name: 'Inbox',
    description: '',
    color: '#3b82f6',
    order_index: 0,
    is_archived: false,
    created_at: '',
    updated_at: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotesApi.getByDate.mockResolvedValue({ id: 1 });
    mockEntriesApi.create.mockResolvedValue(mockEntry);
    mockEntriesApi.delete.mockResolvedValue(undefined);
  });

  it('creates an entry on mount and renders the editor', async () => {
    render(<CreateEntryModal onClose={onClose} onSuccess={onSuccess} />);

    await screen.findByText('Create New Card');
    expect(mockEntriesApi.create).toHaveBeenCalled();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('adds the new entry to the provided list', async () => {
    render(<CreateEntryModal list={list} onClose={onClose} onSuccess={onSuccess} />);

    await waitFor(() => expect(mockListsApi.addEntry).toHaveBeenCalledWith(9, 42));
  });

  it('closes and deletes empty entries when Escape is pressed', async () => {
    render(<CreateEntryModal onClose={onClose} onSuccess={onSuccess} />);
    await screen.findByText('Create New Card');

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(mockEntriesApi.delete).toHaveBeenCalledWith(42));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

