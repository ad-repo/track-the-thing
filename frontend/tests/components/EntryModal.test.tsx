import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EntryModal from '@/components/EntryModal';
import type { NoteEntry } from '@/types';

const mockNotesApi = vi.hoisted(() => ({
  getAll: vi.fn(),
}));

const mockEntriesApi = vi.hoisted(() => ({
  delete: vi.fn(),
}));

vi.mock('@/api', () => ({
  __esModule: true,
  notesApi: mockNotesApi,
  entriesApi: mockEntriesApi,
}));

vi.mock('@/components/NoteEntryCard', () => ({
  __esModule: true,
  default: ({ onDelete, onUpdate }: { onDelete: (id: number) => void; onUpdate: (id: number, content: string) => void }) => (
    <div>
      <button onClick={() => onUpdate(1, 'new content')}>Update Entry</button>
      <button onClick={() => onDelete(1)}>Delete Entry</button>
    </div>
  ),
}));

const buildEntry = (id: number): NoteEntry => ({
  id,
  daily_note_id: 1,
  title: 'Entry',
  content: '<p>Body</p>',
  content_type: 'rich_text',
  order_index: 0,
  created_at: '',
  updated_at: '',
  labels: [],
  include_in_report: false,
  is_important: false,
  is_completed: false,
  is_pinned: false,
});

describe('EntryModal', () => {
  const onClose = vi.fn();
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotesApi.getAll.mockResolvedValue([{ id: 1, entries: [buildEntry(1)] }]);
    mockEntriesApi.delete.mockResolvedValue(undefined);
  });

  const renderModal = () => render(<EntryModal entryId={1} onClose={onClose} onUpdate={onUpdate} />);

  it('loads the entry and renders NoteEntryCard', async () => {
    renderModal();

    await screen.findByText('Update Entry');
    expect(mockNotesApi.getAll).toHaveBeenCalled();
  });

  it('deletes the entry when confirmed', async () => {
    (window.confirm as any) = vi.fn(() => true);
    renderModal();

    const deleteBtn = await screen.findByText('Delete Entry');
    fireEvent.click(deleteBtn);

    await waitFor(() => expect(mockEntriesApi.delete).toHaveBeenCalledWith(1));
    expect(onClose).toHaveBeenCalled();
  });
});

