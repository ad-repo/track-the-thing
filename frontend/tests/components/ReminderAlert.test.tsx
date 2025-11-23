import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReminderAlert from '@/components/ReminderAlert';
import type { Reminder } from '@/types';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

const reminder: Reminder = {
  id: 1,
  entry_id: 1,
  reminder_datetime: '2025-11-07T09:00:00Z',
  is_dismissed: false,
  created_at: '',
  updated_at: '',
  entry: {
    id: 2,
    daily_note_id: 1,
    daily_note_date: '2025-11-07',
    title: 'Reminder Entry',
    content: '<p>Reminder body</p>',
    content_type: 'rich_text',
    order_index: 0,
    created_at: '',
    updated_at: '',
    labels: [],
    include_in_report: false,
    is_important: false,
    is_completed: false,
    is_pinned: false,
  },
};

describe('ReminderAlert', () => {
  const onSnooze = vi.fn();
  const onDismiss = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderAlert = () =>
    render(<ReminderAlert reminder={reminder} onSnooze={onSnooze} onDismiss={onDismiss} onClose={onClose} />);

  it('navigates to the entry when View Entry is clicked', () => {
    renderAlert();

    fireEvent.click(screen.getByText(/view entry/i));

    expect(mockNavigate).toHaveBeenCalledWith('/day/2025-11-07');
    expect(onClose).toHaveBeenCalled();
  });

  it('invokes snooze and dismiss callbacks', () => {
    renderAlert();

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    fireEvent.click(screen.getByRole('button', { name: /snooze 1 day/i }));

    expect(onDismiss).toHaveBeenCalled();
    expect(onSnooze).toHaveBeenCalled();
  });
});

