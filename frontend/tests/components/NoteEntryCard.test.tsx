import { render, screen, fireEvent } from '@testing-library/react';
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
  default: () => <div data-testid="label-selector" />,
}));

vi.mock('@/components/EntryListSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="list-selector" />,
}));

vi.mock('@/components/ReminderModal', () => ({
  __esModule: true,
  default: () => null,
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
});

