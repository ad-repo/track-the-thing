import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NoteEntryCard from '@/components/NoteEntryCard';
import type { NoteEntry } from '@/types';
import { MemoryRouter } from 'react-router-dom';

const mockAxiosPatch = vi.hoisted(() => vi.fn());
const mockAxiosPost = vi.hoisted(() => vi.fn());

vi.mock('axios', () => {
  const instance = {
    get: vi.fn(),
    post: mockAxiosPost,
    patch: mockAxiosPatch,
    put: vi.fn(),
    delete: vi.fn(),
  };

  return {
    __esModule: true,
    default: {
      ...instance,
      create: vi.fn(() => instance),
    },
  };
});

const mockKanbanApi = vi.hoisted(() => ({
  getBoards: vi.fn().mockResolvedValue([]),
}));
const mockListsApi = vi.hoisted(() => ({
  addEntry: vi.fn(),
  removeEntry: vi.fn(),
}));
const mockRemindersApi = vi.hoisted(() => ({
  getForEntry: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/api', () => ({
  __esModule: true,
  kanbanApi: mockKanbanApi,
  listsApi: mockListsApi,
  remindersApi: mockRemindersApi,
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

vi.mock('@/hooks/useTexture', () => ({
  useTexture: () => ({}),
}));

vi.mock('@/components/RichTextEditor', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (value: string) => void }) => (
    <textarea data-testid="rich-editor" onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock('@/components/CodeEditor', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('@/components/LabelSelector', () => ({
  __esModule: true,
  default: ({ onOptimisticUpdate }: { onOptimisticUpdate?: (labels: any[]) => void }) => (
    <div data-testid="label-selector">
      <button
        data-testid="add-label"
        onClick={() => onOptimisticUpdate?.([{ id: 99, name: 'New', color: '#000000' }])}
      >
        Add Label
      </button>
    </div>
  ),
}));

vi.mock('@/components/EntryListSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="list-selector" />,
}));

vi.mock('@/components/ReminderModal', () => ({
  __esModule: true,
  default: ({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) => (
    <div data-testid="reminder-modal">
      <button onClick={onSuccess}>save reminder</button>
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

const baseEntry: NoteEntry = {
  id: 1,
  daily_note_id: 1,
  title: 'Original title',
  content: '<p>Body</p>',
  content_type: 'rich_text',
  order_index: 0,
  created_at: '2025-11-07T09:00:00Z',
  updated_at: '2025-11-07T09:00:00Z',
  labels: [],
  include_in_report: false,
  is_important: false,
  is_completed: false,
  is_pinned: false,
};

describe('NoteEntryCard', () => {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  const onLabelsUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosPatch.mockResolvedValue({});
    mockAxiosPost.mockResolvedValue({});
    mockRemindersApi.getForEntry.mockResolvedValue(null);
    (navigator as any).clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
      write: vi.fn().mockResolvedValue(undefined),
    };
  });

  const renderCard = (entry: NoteEntry = baseEntry) =>
    render(
      <MemoryRouter>
        <NoteEntryCard
          entry={entry}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onLabelsUpdate={onLabelsUpdate}
        />
      </MemoryRouter>,
    );

  it('debounces title updates before sending patch request', () => {
    vi.useFakeTimers();
    renderCard();

    const input = screen.getByDisplayValue('Original title');
    fireEvent.change(input, { target: { value: 'Refined title' } });

    expect(mockAxiosPatch).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(mockAxiosPatch).toHaveBeenCalledWith(expect.stringContaining('/api/entries/1'), {
      title: 'Refined title',
    });
    vi.useRealTimers();
  });

  it('confirms deletion through the modal', () => {
    renderCard();

    fireEvent.click(screen.getByTitle('Delete entry'));
    expect(screen.getByText('Delete Card?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /delete card/i }));

    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('toggles pin status and hits the toggle endpoint', async () => {
    renderCard();

    const pinButton = screen.getByTitle('Pin (copy to future days)');
    fireEvent.click(pinButton);

    await waitFor(() =>
      expect(mockAxiosPost).toHaveBeenCalledWith(expect.stringContaining('/api/entries/1/toggle-pin')),
    );
    expect(screen.getByTitle('Unpin (stop copying to future days)')).toBeInTheDocument();
  });

  it('applies labels via the selector and notifies the parent', () => {
    renderCard();

    fireEvent.click(screen.getByTestId('add-label'));

    expect(onLabelsUpdate).toHaveBeenCalledWith(1, expect.arrayContaining([expect.objectContaining({ id: 99 })]));
  });

  it('opens the reminder modal and refreshes reminder state on success', async () => {
    mockRemindersApi.getForEntry.mockResolvedValueOnce({ id: 7, remind_at: '2025-11-08T09:00:00Z' } as any);
    renderCard();

    const reminderButton = screen.getByTitle('Set reminder');
    fireEvent.click(reminderButton);

    const modal = await screen.findByTestId('reminder-modal');
    fireEvent.click(within(modal).getByText(/save reminder/i));

    await waitFor(() => expect(mockRemindersApi.getForEntry).toHaveBeenCalledWith(1));
    const updatedButton = screen.getByTitle('Edit reminder');
    const reminderIcon = updatedButton.querySelector('svg');
    expect(reminderIcon).toHaveClass('fill-current');
  });

  it('copies markdown content including the title', async () => {
    renderCard();

    fireEvent.click(screen.getByTitle('Copy as Markdown'));

    await waitFor(() => expect((navigator as any).clipboard.writeText).toHaveBeenCalled());
    const markdown = (navigator as any).clipboard.writeText.mock.calls[0][0] as string;
    expect(markdown).toContain('# Original title');
    expect(markdown).toContain('Body');
    expect(screen.getByTitle('Copied as Markdown!')).toBeInTheDocument();
  });
});

