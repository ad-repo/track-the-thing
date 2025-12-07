/**
 * GoalForm Component Tests
 *
 * Tests for the GoalForm component covering validation, submission, and goal type selection.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GoalForm from '@/components/GoalForm';
import type { Goal } from '@/types';

// Mock RichTextEditor to avoid TipTap complexity
vi.mock('@/components/RichTextEditor', () => ({
  default: ({ content, onChange, placeholder }: { content: string; onChange: (val: string) => void; placeholder?: string }) => (
    <textarea
      data-testid="rich-text-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

// Mock react-calendar
vi.mock('react-calendar', () => ({
  default: ({ onChange, value }: { onChange: (date: Date) => void; value: Date | null }) => (
    <div data-testid="calendar-mock">
      <button
        data-testid="select-date"
        onClick={() => onChange(new Date('2025-11-15'))}
      >
        Select Nov 15
      </button>
    </div>
  ),
}));

const buildGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 1,
  name: 'Test Goal',
  goal_type: 'Personal',
  text: '<p>Goal description</p>',
  start_date: '2025-11-01',
  end_date: '2025-11-30',
  end_time: '',
  status_text: '',
  show_countdown: true,
  is_completed: false,
  is_visible: true,
  order_index: 0,
  completed_at: null,
  created_at: '2025-11-01T12:00:00Z',
  updated_at: '2025-11-01T12:00:00Z',
  ...overrides,
});

describe('GoalForm', () => {
  const onSave = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderForm = (props: Partial<Parameters<typeof GoalForm>[0]> = {}) =>
    render(<GoalForm onSave={onSave} onClose={onClose} {...props} />);

  describe('Rendering', () => {
    it('renders new goal form with empty fields', () => {
      renderForm();

      expect(screen.getByText('New Goal')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('What do you want to achieve?')).toHaveValue('');
      expect(screen.getByRole('button', { name: /create goal/i })).toBeInTheDocument();
    });

    it('renders edit form with existing goal data', () => {
      const goal = buildGoal({ name: 'Existing Goal', goal_type: 'Sprint' });
      renderForm({ goal });

      expect(screen.getByText('Edit Goal')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('What do you want to achieve?')).toHaveValue('Existing Goal');
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('renders inline version without modal overlay', () => {
      const { container } = renderForm({ inline: true });

      // Inline version has rounded-xl class directly on container
      expect(container.querySelector('.rounded-xl')).toBeInTheDocument();
      // Should not have fixed overlay
      expect(container.querySelector('.fixed')).not.toBeInTheDocument();
    });

    it('renders modal version with overlay', () => {
      const { container } = renderForm({ inline: false });

      expect(container.querySelector('.fixed')).toBeInTheDocument();
    });
  });

  describe('Goal Type Selection', () => {
    it('shows time-based goal types', () => {
      renderForm();

      expect(screen.getByText('Time-based:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Daily' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Weekly' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sprint' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Monthly' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Quarterly' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Yearly' })).toBeInTheDocument();
    });

    it('shows lifestyle goal types', () => {
      renderForm();

      expect(screen.getByText('Lifestyle:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Fitness' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Health' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Learning' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Personal' })).toBeInTheDocument();
    });

    it('allows selecting custom goal type', () => {
      renderForm();

      fireEvent.click(screen.getByRole('button', { name: /custom/i }));

      expect(screen.getByPlaceholderText('Type name...')).toBeInTheDocument();
    });

    it('shows custom type input when editing custom type goal', () => {
      const goal = buildGoal({ goal_type: 'Custom:MyProject' });
      renderForm({ goal });

      expect(screen.getByPlaceholderText('Type name...')).toHaveValue('MyProject');
    });
  });

  describe('Form Validation', () => {
    it('shows error when name is empty on submit', async () => {
      renderForm();

      fireEvent.click(screen.getByRole('button', { name: /create goal/i }));

      await waitFor(() => {
        expect(screen.getByText('Goal name is required')).toBeInTheDocument();
      });
      expect(onSave).not.toHaveBeenCalled();
    });

    it('shows error when custom type name is empty', async () => {
      renderForm();

      // Fill in name
      fireEvent.change(screen.getByPlaceholderText('What do you want to achieve?'), {
        target: { value: 'My Goal' },
      });

      // Select custom type but leave name empty
      fireEvent.click(screen.getByRole('button', { name: /custom/i }));

      fireEvent.click(screen.getByRole('button', { name: /create goal/i }));

      await waitFor(() => {
        expect(screen.getByText('Custom type name is required')).toBeInTheDocument();
      });
    });

    it('shows error when start date is missing for time-based goals', async () => {
      renderForm();

      // Fill in name
      fireEvent.change(screen.getByPlaceholderText('What do you want to achieve?'), {
        target: { value: 'Sprint Goal' },
      });

      // Select time-based type (Sprint)
      fireEvent.click(screen.getByRole('button', { name: 'Sprint' }));

      fireEvent.click(screen.getByRole('button', { name: /create goal/i }));

      await waitFor(() => {
        expect(screen.getByText('Start date is required for time-based goals')).toBeInTheDocument();
      });
    });

    it('shows error when end date is before start date', async () => {
      const goal = buildGoal({
        start_date: '2025-11-15',
        end_date: '2025-11-10', // Before start
      });
      renderForm({ goal });

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText('End date must be after or equal to start date')).toBeInTheDocument();
      });
    });

    it('allows empty dates for lifestyle goals', async () => {
      renderForm();

      // Fill in name
      fireEvent.change(screen.getByPlaceholderText('What do you want to achieve?'), {
        target: { value: 'Fitness Goal' },
      });

      // Select lifestyle type (Fitness) - dates not required
      fireEvent.click(screen.getByRole('button', { name: 'Fitness' }));

      fireEvent.click(screen.getByRole('button', { name: /create goal/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Fitness Goal',
            goal_type: 'Fitness',
          })
        );
      });
    });
  });

  describe('Form Submission', () => {
    it('calls onSave with goal data on valid submission', async () => {
      renderForm();

      // Fill in form
      fireEvent.change(screen.getByPlaceholderText('What do you want to achieve?'), {
        target: { value: 'New Goal' },
      });

      // Select lifestyle type (no dates required)
      fireEvent.click(screen.getByRole('button', { name: 'Personal' }));

      fireEvent.click(screen.getByRole('button', { name: /create goal/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Goal',
            goal_type: 'Personal',
            show_countdown: true,
            is_visible: true,
          })
        );
      });
    });

    it('calls onSave with custom type', async () => {
      renderForm();

      // Fill in name
      fireEvent.change(screen.getByPlaceholderText('What do you want to achieve?'), {
        target: { value: 'Custom Goal' },
      });

      // Select custom type
      fireEvent.click(screen.getByRole('button', { name: /custom/i }));
      fireEvent.change(screen.getByPlaceholderText('Type name...'), {
        target: { value: 'ProjectX' },
      });

      fireEvent.click(screen.getByRole('button', { name: /create goal/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Custom Goal',
            goal_type: 'Custom:ProjectX',
          })
        );
      });
    });

    it('includes description text in submission', async () => {
      renderForm();

      fireEvent.change(screen.getByPlaceholderText('What do you want to achieve?'), {
        target: { value: 'Goal with Description' },
      });

      fireEvent.change(screen.getByTestId('rich-text-editor'), {
        target: { value: '<p>Goal details here</p>' },
      });

      fireEvent.click(screen.getByRole('button', { name: /create goal/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            text: '<p>Goal details here</p>',
          })
        );
      });
    });
  });

  describe('Options Toggles', () => {
    it('toggles show countdown checkbox', () => {
      renderForm();

      const checkboxes = screen.getAllByRole('checkbox');
      const countdownCheckbox = checkboxes[0]; // First checkbox is "Show countdown"
      expect(countdownCheckbox).toBeChecked();

      fireEvent.click(countdownCheckbox);
      expect(countdownCheckbox).not.toBeChecked();
    });

    it('toggles show on daily view checkbox', () => {
      renderForm();

      const checkboxes = screen.getAllByRole('checkbox');
      const visibilityCheckbox = checkboxes[1]; // Second checkbox is "Show on Daily View"
      expect(visibilityCheckbox).toBeChecked();

      fireEvent.click(visibilityCheckbox);
      expect(visibilityCheckbox).not.toBeChecked();
    });

    it('shows end time input for Daily goals', () => {
      renderForm();

      // Select Daily type
      fireEvent.click(screen.getByRole('button', { name: 'Daily' }));

      expect(screen.getByText(/end time/i)).toBeInTheDocument();
    });

    it('shows status text input for lifestyle goals', () => {
      renderForm();

      // Select Fitness type (lifestyle)
      fireEvent.click(screen.getByRole('button', { name: 'Fitness' }));

      expect(screen.getByText(/status text/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/3\/10 workouts/i)).toBeInTheDocument();
    });
  });

  describe('Close Actions', () => {
    it('calls onClose when cancel button clicked', () => {
      renderForm();

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when X button clicked', () => {
      renderForm();

      // Find the close button in the header
      const closeButtons = screen.getAllByRole('button');
      const xButton = closeButtons.find(btn => btn.querySelector('svg.w-5.h-5'));
      
      if (xButton) {
        fireEvent.click(xButton);
        expect(onClose).toHaveBeenCalled();
      }
    });

    it('calls onClose when clicking modal overlay', () => {
      const { container } = renderForm({ inline: false });

      const overlay = container.querySelector('.fixed');
      if (overlay) {
        fireEvent.click(overlay);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Initial Date', () => {
    it('uses initialDate prop when provided', () => {
      renderForm({ initialDate: '2025-12-01' });

      // The start date should show the formatted initial date
      expect(screen.getByText('Dec 1, 2025')).toBeInTheDocument();
    });
  });
});
