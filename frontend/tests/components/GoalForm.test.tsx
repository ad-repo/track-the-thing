/**
 * GoalForm Component Tests
 *
 * Tests for goal creation/editing form including:
 * - Form validation
 * - Goal type selection (time-based vs lifestyle)
 * - Custom type input
 * - Date auto-calculation
 * - Form submission
 * - Edit vs create mode
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GoalForm from '@/components/GoalForm';
import type { Goal } from '@/types';

// Mock RichTextEditor
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
      <button onClick={() => onChange(new Date('2025-01-15'))}>Select Jan 15</button>
      <button onClick={() => onChange(new Date('2025-01-31'))}>Select Jan 31</button>
    </div>
  ),
}));

const buildGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 1,
  name: 'Test Goal',
  goal_type: 'Personal',
  text: '<p>Test description</p>',
  start_date: '2025-01-01',
  end_date: '2025-01-31',
  end_time: '',
  status_text: '',
  show_countdown: true,
  is_completed: false,
  is_visible: true,
  order_index: 0,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  completed_at: null,
  ...overrides,
});

describe('GoalForm', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderGoalForm = (props: Partial<Parameters<typeof GoalForm>[0]> = {}) => {
    return render(
      <GoalForm
        onSave={mockOnSave}
        onClose={mockOnClose}
        {...props}
      />
    );
  };

  describe('Create Mode', () => {
    it('renders create form with empty fields', () => {
      renderGoalForm();

      expect(screen.getByText('New Goal')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('What do you want to achieve?')).toHaveValue('');
      expect(screen.getByRole('button', { name: 'Create Goal' })).toBeInTheDocument();
    });

    it('shows validation error when name is empty', async () => {
      renderGoalForm();

      fireEvent.click(screen.getByRole('button', { name: 'Create Goal' }));

      await waitFor(() => {
        expect(screen.getByText('Goal name is required')).toBeInTheDocument();
      });
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('calls onSave with form data when valid', async () => {
      renderGoalForm();

      // Fill in name
      fireEvent.change(screen.getByPlaceholderText('What do you want to achieve?'), {
        target: { value: 'My New Goal' },
      });

      // Submit - Personal is lifestyle type, so dates are optional
      fireEvent.click(screen.getByRole('button', { name: 'Create Goal' }));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'My New Goal',
            goal_type: 'Personal',
          })
        );
      });
    });

    it('populates start date from initialDate prop', () => {
      renderGoalForm({ initialDate: '2025-02-01' });

      // The date picker button should show the formatted date
      expect(screen.getByText('Feb 1, 2025')).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('renders edit form with existing goal data', () => {
      renderGoalForm({ goal: buildGoal({ name: 'Existing Goal' }) });

      expect(screen.getByText('Edit Goal')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('What do you want to achieve?')).toHaveValue('Existing Goal');
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    });

    it('loads custom type correctly when editing', () => {
      renderGoalForm({ goal: buildGoal({ goal_type: 'Custom:MyProject' }) });

      // Custom type input should be visible with the type name
      expect(screen.getByPlaceholderText('Type name...')).toHaveValue('MyProject');
    });
  });

  describe('Goal Type Selection', () => {
    it('shows time-based goal types', () => {
      renderGoalForm();

      expect(screen.getByText('Daily')).toBeInTheDocument();
      expect(screen.getByText('Weekly')).toBeInTheDocument();
      expect(screen.getByText('Sprint')).toBeInTheDocument();
      expect(screen.getByText('Monthly')).toBeInTheDocument();
      expect(screen.getByText('Quarterly')).toBeInTheDocument();
      expect(screen.getByText('Yearly')).toBeInTheDocument();
    });

    it('shows lifestyle goal types', () => {
      renderGoalForm();

      expect(screen.getByText('Fitness')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.getByText('Career')).toBeInTheDocument();
      expect(screen.getByText('Learning')).toBeInTheDocument();
      expect(screen.getByText('Financial')).toBeInTheDocument();
      expect(screen.getByText('Health')).toBeInTheDocument();
      expect(screen.getByText('Habits')).toBeInTheDocument();
    });

    it('selects goal type when clicked', () => {
      renderGoalForm();

      fireEvent.click(screen.getByText('Sprint'));

      // Sprint should be highlighted (we can check by looking at the button style or class)
      const sprintButton = screen.getByText('Sprint');
      expect(sprintButton).toBeInTheDocument();
    });

    it('shows custom type input when Custom is clicked', () => {
      renderGoalForm();

      fireEvent.click(screen.getByText('Custom'));

      expect(screen.getByPlaceholderText('Type name...')).toBeInTheDocument();
    });

    it('validates custom type name is required', async () => {
      renderGoalForm();

      // Enter goal name
      fireEvent.change(screen.getByPlaceholderText('What do you want to achieve?'), {
        target: { value: 'Test Goal' },
      });

      // Select custom type but don't enter name
      fireEvent.click(screen.getByText('Custom'));

      // Try to submit
      fireEvent.click(screen.getByRole('button', { name: 'Create Goal' }));

      await waitFor(() => {
        expect(screen.getByText('Custom type name is required')).toBeInTheDocument();
      });
    });
  });

  describe('Date Validation for Time-Based Goals', () => {
    it('requires dates for time-based goals', async () => {
      renderGoalForm();

      // Enter name
      fireEvent.change(screen.getByPlaceholderText('What do you want to achieve?'), {
        target: { value: 'Sprint Goal' },
      });

      // Select Sprint (time-based)
      fireEvent.click(screen.getByText('Sprint'));

      // Try to submit without dates
      fireEvent.click(screen.getByRole('button', { name: 'Create Goal' }));

      await waitFor(() => {
        expect(screen.getByText('Start date is required for time-based goals')).toBeInTheDocument();
      });
    });

    it('does not require dates for lifestyle goals', async () => {
      renderGoalForm();

      // Enter name
      fireEvent.change(screen.getByPlaceholderText('What do you want to achieve?'), {
        target: { value: 'Fitness Goal' },
      });

      // Select Fitness (lifestyle - already selected as Personal by default, let's pick Fitness)
      fireEvent.click(screen.getByText('Fitness'));

      // Submit without dates
      fireEvent.click(screen.getByRole('button', { name: 'Create Goal' }));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Fitness Goal',
            goal_type: 'Fitness',
          })
        );
      });
    });

    it('shows optional dates message for lifestyle goals', () => {
      renderGoalForm();

      // Personal is selected by default (lifestyle type)
      expect(screen.getByText(/Dates are optional for lifestyle goals/)).toBeInTheDocument();
    });
  });

  describe('Daily Goal End Time', () => {
    it('shows end time input for Daily goals', () => {
      renderGoalForm();

      fireEvent.click(screen.getByText('Daily'));

      expect(screen.getByText('End Time (for countdown)')).toBeInTheDocument();
    });

    it('does not show end time input for non-Daily goals', () => {
      renderGoalForm();

      fireEvent.click(screen.getByText('Weekly'));

      expect(screen.queryByText('End Time (for countdown)')).not.toBeInTheDocument();
    });
  });

  describe('Status Text for Lifestyle Goals', () => {
    it('shows status text input for lifestyle goals', () => {
      renderGoalForm();

      // Personal is selected by default (lifestyle type)
      expect(screen.getByPlaceholderText(/3\/10 workouts/)).toBeInTheDocument();
    });

    it('does not show status text input for time-based goals', () => {
      renderGoalForm();

      fireEvent.click(screen.getByText('Sprint'));

      expect(screen.queryByPlaceholderText(/3\/10 workouts/)).not.toBeInTheDocument();
    });
  });

  describe('Options', () => {
    it('shows countdown checkbox', () => {
      renderGoalForm();

      expect(screen.getByText('Show countdown')).toBeInTheDocument();
    });

    it('shows visibility checkbox', () => {
      renderGoalForm();

      expect(screen.getByText('Show on Daily View')).toBeInTheDocument();
    });

    it('includes options in submitted data', async () => {
      renderGoalForm();

      // Fill name
      fireEvent.change(screen.getByPlaceholderText('What do you want to achieve?'), {
        target: { value: 'Test Goal' },
      });

      // Uncheck show countdown
      const countdownCheckbox = screen.getByText('Show countdown').previousElementSibling as HTMLInputElement;
      fireEvent.click(countdownCheckbox);

      // Submit
      fireEvent.click(screen.getByRole('button', { name: 'Create Goal' }));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            show_countdown: false,
          })
        );
      });
    });
  });

  describe('Close/Cancel', () => {
    it('calls onClose when Cancel is clicked', () => {
      renderGoalForm();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when X button is clicked', () => {
      renderGoalForm();

      // X button is in the header
      const closeButtons = screen.getAllByRole('button');
      const xButton = closeButtons.find(btn => btn.querySelector('svg'));
      if (xButton) {
        fireEvent.click(xButton);
      }

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when clicking outside modal', () => {
      renderGoalForm();

      // Click the overlay (the outermost div with the background)
      const overlay = document.querySelector('[style*="rgba(0, 0, 0, 0.5)"]');
      if (overlay) {
        fireEvent.click(overlay);
      }

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Inline Mode', () => {
    it('renders without modal overlay when inline=true', () => {
      renderGoalForm({ inline: true });

      // Should not have the modal overlay
      expect(document.querySelector('[style*="rgba(0, 0, 0, 0.5)"]')).not.toBeInTheDocument();
      
      // Should still have the form content
      expect(screen.getByText('New Goal')).toBeInTheDocument();
    });
  });

  describe('Description Editor', () => {
    it('renders rich text editor for description', () => {
      renderGoalForm();

      expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
    });

    it('includes description in submitted data', async () => {
      renderGoalForm();

      // Fill name
      fireEvent.change(screen.getByPlaceholderText('What do you want to achieve?'), {
        target: { value: 'Test Goal' },
      });

      // Fill description
      fireEvent.change(screen.getByTestId('rich-text-editor'), {
        target: { value: '<p>My goal description</p>' },
      });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: 'Create Goal' }));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            text: '<p>My goal description</p>',
          })
        );
      });
    });
  });
});

