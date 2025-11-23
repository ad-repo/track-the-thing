import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReminderModal from '@/components/ReminderModal';
import type { NoteEntry, Reminder } from '@/types';

const mockRemindersApi = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/api', () => ({
  __esModule: true,
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

vi.mock('@/utils/timezone', () => ({
  formatTimestamp: (value: string) => value,
}));

const entry: NoteEntry = {
  id: 1,
  daily_note_id: 1,
  title: 'Daily card',
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

describe('ReminderModal', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window.confirm as any) = vi.fn(() => true);
  });

  it('creates a reminder with the selected date and time', async () => {
    render(<ReminderModal entry={entry} existingReminder={null} onClose={onClose} onSuccess={onSuccess} />);

    await screen.findByText(/date/i);
    const dateInput = screen.getByText(/date/i).parentElement?.querySelector('input') as HTMLInputElement;
    const timeInput = screen.getByText(/time/i).parentElement?.querySelector('input') as HTMLInputElement;

    fireEvent.change(dateInput, { target: { value: '2025-11-15' } });
    fireEvent.change(timeInput, { target: { value: '10:30' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockRemindersApi.create).toHaveBeenCalledWith({
        entry_id: 1,
        reminder_datetime: new Date('2025-11-15T10:30').toISOString(),
      });
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('deletes an existing reminder when confirmed', async () => {
    const reminder: Reminder = {
      id: 5,
      entry_id: 1,
      reminder_datetime: '2025-11-10T09:00:00Z',
      is_dismissed: false,
      created_at: '',
      updated_at: '',
    };

    render(<ReminderModal entry={entry} existingReminder={reminder} onClose={onClose} onSuccess={onSuccess} />);

    await screen.findByRole('button', { name: /delete/i });
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => expect(mockRemindersApi.delete).toHaveBeenCalledWith(5));
    expect(onSuccess).toHaveBeenCalled();
  });
});

