import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import CalendarView from '@/components/CalendarView';
import { renderWithRouter } from '../test-utils';

const mockNotesApi = vi.hoisted(() => ({
  getByMonth: vi.fn(),
}));

const mockGoalsApi = vi.hoisted(() => ({
  getAll: vi.fn(),
}));

const mockRemindersApi = vi.hoisted(() => ({
  getAll: vi.fn(),
}));

vi.mock('@/api', () => ({
  __esModule: true,
  notesApi: mockNotesApi,
  goalsApi: mockGoalsApi,
  remindersApi: mockRemindersApi,
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ key: 'location-key' }),
  };
});

vi.mock('react-calendar', () => ({
  default: ({ onClickDay, onActiveStartDateChange, tileContent }: any) => (
    <div data-testid="calendar">
      <button onClick={() => onClickDay(new Date('2025-11-15'))}>Select Date</button>
      <button
        onClick={() => onActiveStartDateChange({ activeStartDate: new Date('2025-12-01'), action: 'next' })}
      >
        Change Month
      </button>
      <div data-testid='tile-content'>{tileContent({ date: new Date('2025-11-07') })}</div>
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Star: () => <span>StarIcon</span>,
  Check: () => <span>CheckIcon</span>,
  Bell: () => <span>BellIcon</span>,
  Clock: () => <span>ClockIcon</span>,
  X: () => <span>XIcon</span>,
}));

vi.mock('@/contexts/SprintNameContext', () => ({
  useSprintName: () => ({ sprintName: 'Sprint' }),
}));

vi.mock('@/hooks/useTexture', () => ({
  useTexture: () => ({}),
}));

const buildNote = (date: string) => ({
  id: 1,
  date,
  daily_goal: 'Focus',
  entries: [
    { id: 1, is_important: true, is_completed: true, title: 'Entry', content: '', content_type: 'rich_text' },
  ],
  fire_rating: 3,
  created_at: '',
  updated_at: '',
  labels: [],
});

describe('CalendarView', () => {
  const mockOnDateSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotesApi.getByMonth.mockResolvedValue([buildNote('2025-11-07')]);
    mockGoalsApi.getAll.mockResolvedValue([
      { id: 1, name: 'Sprint Goal', goal_type: 'Sprint', text: 'Sprint Goal', start_date: '2025-11-01', end_date: '2025-11-30', is_visible: true },
      { id: 2, name: 'Quarterly Goal', goal_type: 'Quarterly', text: 'Quarterly Goal', start_date: '2025-10-01', end_date: '2025-12-31', is_visible: true },
    ]);
    mockRemindersApi.getAll.mockResolvedValue([
      { id: 1, reminder_datetime: '2025-11-07T10:00:00Z' },
    ]);
  });

  const renderCalendar = () =>
    renderWithRouter(<CalendarView selectedDate={new Date('2025-11-07')} onDateSelect={mockOnDateSelect} />);

  it('renders tile indicators for notes, reminders, and goals', async () => {
    renderCalendar();

    await waitFor(() => expect(mockNotesApi.getByMonth).toHaveBeenCalledTimes(3));

    expect(screen.getByText('StarIcon')).toBeInTheDocument();
    expect(screen.getByText('CheckIcon')).toBeInTheDocument();
    expect(screen.getByText('BellIcon')).toBeInTheDocument();
    expect(screen.getByText('🎯')).toBeInTheDocument();
  });

  it('invokes onDateSelect and navigates when a day is chosen', async () => {
    renderCalendar();
    await screen.findByTestId('calendar');

    fireEvent.click(screen.getByText('Select Date'));

    expect(mockOnDateSelect).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/day/2025-11-15');
  });

  it('reloads month data when the visible month changes', async () => {
    renderCalendar();
    await waitFor(() => expect(mockNotesApi.getByMonth).toHaveBeenCalledTimes(3));

    fireEvent.click(screen.getByText('Change Month'));

    await waitFor(() => expect(mockNotesApi.getByMonth).toHaveBeenCalledTimes(6));
  });
});

