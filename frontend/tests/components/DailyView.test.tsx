import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DailyView from '@/components/DailyView';
import { renderWithRouter } from '../test-utils';
import type { DailyNote, NoteEntry } from '@/types';

const mockNotesApi = vi.hoisted(() => ({
  getByDate: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));

const mockEntriesApi = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

const mockGoalsApi = vi.hoisted(() => ({
  getSprintForDate: vi.fn(),
  getQuarterlyForDate: vi.fn(),
  getActiveForDate: vi.fn(),
}));

const mockSettingsApi = vi.hoisted(() => ({
  get: vi.fn(),
}));

const mockApi = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('@/api', () => ({
  __esModule: true,
  default: mockApi,
  notesApi: mockNotesApi,
  entriesApi: mockEntriesApi,
  goalsApi: mockGoalsApi,
  settingsApi: mockSettingsApi,
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ date: '2025-11-07' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

let showDailyGoals = true;
let showDayLabels = true;

vi.mock('@/contexts/FullScreenContext', () => ({
  useFullScreen: () => ({ isFullScreen: false }),
}));
vi.mock('@/contexts/DailyGoalsContext', () => ({
  useDailyGoals: () => ({ showDailyGoals }),
}));
vi.mock('@/contexts/SprintGoalsContext', () => ({
  useSprintGoals: () => ({ showSprintGoals: true }),
}));
vi.mock('@/contexts/SprintNameContext', () => ({
  useSprintName: () => ({ sprintName: 'Sprint' }),
}));
vi.mock('@/contexts/QuarterlyGoalsContext', () => ({
  useQuarterlyGoals: () => ({ showQuarterlyGoals: true }),
}));
vi.mock('@/contexts/DayLabelsContext', () => ({
  useDayLabels: () => ({ showDayLabels }),
}));

vi.mock('@/hooks/useTexture', () => ({
  useTexture: () => ({}),
}));

vi.mock('@/components/LabelSelector', () => ({
  default: () => <div data-testid="label-selector" />,
}));

vi.mock('@/components/EntryDropdown', () => ({
  default: () => <div data-testid="entry-dropdown" />,
}));

vi.mock('@/components/SimpleRichTextEditor', () => ({
  default: ({ placeholder }: { placeholder: string }) => (
    <textarea data-testid="daily-goal-input" placeholder={placeholder} />
  ),
}));

vi.mock('@/components/NoteEntryCard', () => ({
  default: ({
    entry,
    onDelete,
    onSelectionChange,
    selectionMode,
    isSelected,
    onMoveToTop,
  }: {
    entry: NoteEntry;
    onDelete: (id: number) => void;
    onSelectionChange: (id: number, selected: boolean) => void;
    selectionMode?: boolean;
    isSelected?: boolean;
    onMoveToTop?: (id: number) => void;
  }) => (
    <div data-testid={`card-${entry.id}`}>
      <span>{entry.title}</span>
      {selectionMode && (
        <input
          type="checkbox"
          data-testid={`select-${entry.id}`}
          checked={isSelected}
          onChange={(e) => onSelectionChange(entry.id, e.target.checked)}
        />
      )}
      <button onClick={() => onDelete(entry.id)} data-testid={`delete-${entry.id}`}>
        Delete {entry.id}
      </button>
      <button onClick={() => onSelectionChange(entry.id, true)} data-testid={`quick-select-${entry.id}`}>
        Select {entry.id}
      </button>
      <button onClick={() => onMoveToTop?.(entry.id)} data-testid={`move-${entry.id}`}>
        Move {entry.id}
      </button>
    </div>
  ),
}));

const buildEntry = (id: number, overrides: Partial<NoteEntry> = {}): NoteEntry => ({
  id,
  daily_note_id: 1,
  title: `Entry ${id}`,
  content: `<p>Entry ${id}</p>`,
  content_type: 'rich_text',
  order_index: id,
  created_at: '',
  updated_at: '',
  labels: [],
  include_in_report: false,
  is_important: id === 1,
  is_completed: false,
  is_pinned: false,
  ...overrides,
});

const buildDailyNote = (entries: NoteEntry[]): DailyNote => ({
  id: 1,
  date: '2025-11-07',
  fire_rating: 3,
  daily_goal: 'Ship it',
  created_at: '',
  updated_at: '',
  entries,
  labels: [],
});

describe('DailyView', () => {
  const baseEntries = [buildEntry(1), buildEntry(2)];

  beforeEach(() => {
    vi.clearAllMocks();
    showDailyGoals = true;
    showDayLabels = true;
    window.scrollTo = vi.fn();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    mockSettingsApi.get.mockResolvedValue({
      daily_goal_end_time: '17:00',
    });
    mockGoalsApi.getSprintForDate.mockRejectedValue({ response: { status: 404 } });
    mockGoalsApi.getQuarterlyForDate.mockRejectedValue({ response: { status: 404 } });
    mockGoalsApi.getActiveForDate.mockResolvedValue([]);
    mockNotesApi.getByDate.mockResolvedValue(buildDailyNote(baseEntries));
    mockEntriesApi.create.mockResolvedValue(buildEntry(99, { title: 'Fresh Card' }));
    mockEntriesApi.delete.mockResolvedValue(undefined);
    mockApi.post.mockResolvedValue({ data: {} });
  });

  const renderDailyView = () => renderWithRouter(<DailyView />, { route: '/day/2025-11-07' });

  it('loads daily note and renders existing entries', async () => {
    renderDailyView();
    await screen.findByText('Entry 1');

    expect(mockNotesApi.getByDate).toHaveBeenCalledWith('2025-11-07');
    expect(screen.getByText('Entry 2')).toBeInTheDocument();
  });

  it('hides the daily goals section when the feature is disabled', async () => {
    showDailyGoals = false;
    showDayLabels = false;
    renderDailyView();

    await screen.findByText('Entry 1');

    expect(screen.queryByText(/daily goals/i)).not.toBeInTheDocument();
  });

  it('creates a new entry via the New Card button', async () => {
    renderDailyView();
    await screen.findByText('Entry 1');

    fireEvent.click(screen.getByRole('button', { name: /new card/i }));

    await screen.findByText('Fresh Card');
    expect(mockEntriesApi.create).toHaveBeenCalledWith('2025-11-07', expect.objectContaining({ content: '' }));
  });

  it('removes an entry after confirming deletion', async () => {
    renderDailyView();
    await screen.findByText('Entry 1');

    fireEvent.click(screen.getByTestId('delete-1'));

    await waitFor(() => expect(mockEntriesApi.delete).toHaveBeenCalledWith(1));
  });

  it('merges selected entries and reloads daily note data', async () => {
    mockNotesApi.getByDate.mockResolvedValueOnce(buildDailyNote(baseEntries)).mockResolvedValue(buildDailyNote([buildEntry(42)]));

    renderDailyView();
    await screen.findByText('Entry 1');

    fireEvent.click(screen.getByTitle('Select entries to merge'));
    fireEvent.click(screen.getByTestId('select-1'));
    fireEvent.click(screen.getByTestId('select-2'));

    const mergeButton = await screen.findByRole('button', { name: /merge 2 entries/i });
    fireEvent.click(mergeButton);

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/entries/merge',
        expect.objectContaining({ entry_ids: [1, 2] }),
      ),
    );
    expect(mockNotesApi.getByDate).toHaveBeenCalledTimes(2);
  });

  it('keeps merge disabled until two entries are selected and clears selection on cancel', async () => {
    renderDailyView();
    await screen.findByText('Entry 1');

    fireEvent.click(screen.getByTitle('Select entries to merge'));

    const mergeButton = await screen.findByRole('button', { name: /merge 0 entries/i });
    expect(mergeButton).toBeDisabled();

    fireEvent.click(screen.getByTestId('select-1'));
    expect(screen.getByRole('button', { name: /merge 1 entries/i })).toBeDisabled();

    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByTitle('Select entries to merge'));

    expect(screen.getByRole('button', { name: /merge 0 entries/i })).toBeDisabled();
  });

  it('moves a lower entry to the top when requested', async () => {
    renderDailyView();
    await screen.findByText('Entry 1');

    fireEvent.click(screen.getByTestId('move-2'));

    const orderedTitles = screen.getAllByText(/Entry/).map((el) => el.textContent);
    expect(orderedTitles[0]).toContain('Entry 2');
    expect(orderedTitles[1]).toContain('Entry 1');
  });
});

