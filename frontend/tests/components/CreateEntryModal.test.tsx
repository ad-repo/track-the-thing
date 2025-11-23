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

const noteEntryCardMock = vi.hoisted(() =>
  vi.fn(
    ({
      onListsUpdate,
      onTitleUpdate,
      onLabelsUpdate,
      entry,
    }: {
      onListsUpdate: () => void;
      onTitleUpdate?: (id: number, title: string) => void;
      onLabelsUpdate: (id: number, labels: any[]) => void;
      entry: NoteEntry;
    }) => (
      <div>
        <button onClick={onListsUpdate}>Save</button>
        <button data-testid="mock-set-title" onClick={() => onTitleUpdate?.(entry.id, 'Updated Title')}>
          Set Title
        </button>
        <button data-testid="mock-add-label" onClick={() => onLabelsUpdate(entry.id, [{ id: 1 }])}>
          Add Label
        </button>
      </div>
    ),
  ),
);

vi.mock('@/components/NoteEntryCard', () => ({
  __esModule: true,
  default: (props: any) => noteEntryCardMock(props),
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
    noteEntryCardMock.mockClear();
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

  it('preserves the latest title when labels change', async () => {
    render(<CreateEntryModal onClose={onClose} onSuccess={onSuccess} />);

    await waitFor(() => expect(noteEntryCardMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('mock-set-title'));
    fireEvent.click(screen.getByTestId('mock-add-label'));

    await waitFor(() => {
      const lastCall = noteEntryCardMock.mock.calls.at(-1)?.[0];
      expect(lastCall.entry.title).toBe('Updated Title');
    });
  });
});

