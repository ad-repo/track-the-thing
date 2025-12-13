/**
 * GoalCard Component Tests
 *
 * Tests for the GoalCard component displaying goal information and actions.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GoalCard from '@/components/GoalCard';
import type { Goal } from '@/types';

vi.mock('@/components/SimpleRichTextEditor', () => ({
  default: ({ content, onChange, placeholder }: { content: string; onChange: (val: string) => void; placeholder?: string }) => (
    <textarea
      data-testid="simple-rich-text-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

const buildGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 1,
  name: 'Test Goal',
  goal_type: 'Sprint',
  text: '<p>Goal description</p>',
  start_date: '2025-11-01',
  end_date: '2025-11-14',
  end_time: '',
  status_text: '',
  show_countdown: true,
  is_completed: false,
  is_visible: true,
  order_index: 0,
  completed_at: null,
  created_at: '2025-11-01T12:00:00Z',
  updated_at: '2025-11-01T12:00:00Z',
  days_remaining: 7,
  ...overrides,
});

describe('GoalCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  const renderCard = (props: Partial<Parameters<typeof GoalCard>[0]> = {}) => {
    const defaultProps = {
      goal: buildGoal(),
    };
    return render(<GoalCard {...defaultProps} {...props} />);
  };

  describe('Basic Rendering', () => {
    it('renders goal name', () => {
      renderCard({ goal: buildGoal({ name: 'My Sprint Goal' }) });

      expect(screen.getByText('My Sprint Goal')).toBeInTheDocument();
    });

    it('renders goal type badge', () => {
      renderCard({ goal: buildGoal({ goal_type: 'Sprint' }) });

      expect(screen.getByText('Sprint')).toBeInTheDocument();
    });

    it('renders date range when not compact', () => {
      renderCard({
        goal: buildGoal({ start_date: '2025-11-01', end_date: '2025-11-14' }),
        compact: false,
      });

      expect(screen.getByText('2025-11-01 → 2025-11-14')).toBeInTheDocument();
    });

    it('does not render date range when compact', () => {
      renderCard({
        goal: buildGoal({ start_date: '2025-11-01', end_date: '2025-11-14' }),
        compact: true,
      });

      expect(screen.queryByText('2025-11-01 → 2025-11-14')).not.toBeInTheDocument();
    });

    it('displays custom type name without prefix', () => {
      renderCard({ goal: buildGoal({ goal_type: 'Custom:ProjectX' }) });

      expect(screen.getByText('ProjectX')).toBeInTheDocument();
      expect(screen.queryByText('Custom:ProjectX')).not.toBeInTheDocument();
    });
  });

  describe('Countdown Badge', () => {
    it('shows days remaining when show_countdown is true', () => {
      renderCard({ goal: buildGoal({ show_countdown: true, days_remaining: 5 }) });

      expect(screen.getByText('5 days left')).toBeInTheDocument();
    });

    it('shows "Today!" when days_remaining is 0', () => {
      renderCard({ goal: buildGoal({ show_countdown: true, days_remaining: 0 }) });

      expect(screen.getByText('Today!')).toBeInTheDocument();
    });

    it('shows overdue text when days_remaining is negative', () => {
      renderCard({ goal: buildGoal({ show_countdown: true, days_remaining: -3 }) });

      expect(screen.getByText('3 days overdue')).toBeInTheDocument();
    });

    it('shows status_text for lifestyle goals instead of countdown', () => {
      renderCard({
        goal: buildGoal({
          goal_type: 'Fitness',
          status_text: '3/10 workouts',
          show_countdown: true,
        }),
      });

      expect(screen.getByText('3/10 workouts')).toBeInTheDocument();
    });
  });

  describe('Complete Toggle', () => {
    it('renders complete button when onToggleComplete provided', () => {
      const onToggleComplete = vi.fn();
      renderCard({ onToggleComplete });

      expect(screen.getByTitle('Mark as complete')).toBeInTheDocument();
    });

    it('does not render complete button when onToggleComplete not provided', () => {
      renderCard();

      expect(screen.queryByTitle('Mark as complete')).not.toBeInTheDocument();
    });

    it('calls onToggleComplete when complete button clicked', async () => {
      const onToggleComplete = vi.fn();
      renderCard({ onToggleComplete, goal: buildGoal({ is_completed: false }) });

      fireEvent.click(screen.getByTitle('Mark as complete'));

      await waitFor(() => {
        expect(onToggleComplete).toHaveBeenCalledWith(1);
      });
    });

    it('shows checkmark when goal is completed', () => {
      renderCard({
        goal: buildGoal({ is_completed: true }),
        onToggleComplete: vi.fn(),
      });

      expect(screen.getByTitle('Mark as incomplete')).toBeInTheDocument();
    });

    it('applies line-through style to completed goal name', () => {
      renderCard({
        goal: buildGoal({ name: 'Completed Goal', is_completed: true }),
      });

      const name = screen.getByText('Completed Goal');
      expect(name).toHaveClass('line-through');
    });
  });

  describe('Visibility Toggle', () => {
    it('renders visibility button when showVisibilityToggle is true', () => {
      const onToggleVisibility = vi.fn();
      renderCard({ showVisibilityToggle: true, onToggleVisibility });

      expect(screen.getByTitle('Hide from Daily View')).toBeInTheDocument();
    });

    it('shows "Show on Daily View" when goal is hidden', () => {
      const onToggleVisibility = vi.fn();
      renderCard({
        showVisibilityToggle: true,
        onToggleVisibility,
        goal: buildGoal({ is_visible: false }),
      });

      expect(screen.getByTitle('Show on Daily View')).toBeInTheDocument();
    });

    it('calls onToggleVisibility when visibility button clicked', () => {
      const onToggleVisibility = vi.fn();
      renderCard({
        showVisibilityToggle: true,
        onToggleVisibility,
        goal: buildGoal({ id: 5 }),
      });

      fireEvent.click(screen.getByTitle('Hide from Daily View'));

      expect(onToggleVisibility).toHaveBeenCalledWith(5);
    });
  });

  describe('Edit Button', () => {
    it('renders edit button when editable and onEdit provided', () => {
      const onEdit = vi.fn();
      renderCard({ editable: true, onEdit });

      expect(screen.getByTitle('Edit goal')).toBeInTheDocument();
    });

    it('calls onEdit with goal when edit button clicked', () => {
      const onEdit = vi.fn();
      const goal = buildGoal({ id: 3 });
      renderCard({ editable: true, onEdit, goal });

      fireEvent.click(screen.getByTitle('Edit goal'));

      expect(onEdit).toHaveBeenCalledWith(goal);
    });
  });

  describe('Delete Button', () => {
    it('renders delete button when showDeleteButton is true', () => {
      const onDelete = vi.fn();
      renderCard({ showDeleteButton: true, onDelete });

      expect(screen.getByTitle('Delete goal')).toBeInTheDocument();
    });

    it('shows confirmation dialog before deleting', () => {
      const onDelete = vi.fn();
      renderCard({
        showDeleteButton: true,
        onDelete,
        goal: buildGoal({ name: 'Delete Me' }),
      });

      fireEvent.click(screen.getByTitle('Delete goal'));

      expect(window.confirm).toHaveBeenCalledWith('Delete goal "Delete Me"?');
    });

    it('calls onDelete when confirmed', () => {
      const onDelete = vi.fn();
      window.confirm = vi.fn(() => true);
      renderCard({
        showDeleteButton: true,
        onDelete,
        goal: buildGoal({ id: 7 }),
      });

      fireEvent.click(screen.getByTitle('Delete goal'));

      expect(onDelete).toHaveBeenCalledWith(7);
    });

    it('does not call onDelete when not confirmed', () => {
      const onDelete = vi.fn();
      window.confirm = vi.fn(() => false);
      renderCard({ showDeleteButton: true, onDelete });

      fireEvent.click(screen.getByTitle('Delete goal'));

      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe('Expandable Content', () => {
    it('shows expand button when goal has content', () => {
      renderCard({
        goal: buildGoal({ text: '<p>Some content</p>' }),
        compact: false,
      });

      // ChevronDown should be present for expanding
      const buttons = screen.getAllByRole('button');
      const expandButton = buttons.find(btn => btn.querySelector('svg'));
      expect(expandButton).toBeTruthy();
    });

    it('does not show expand button when goal has empty content', () => {
      renderCard({
        goal: buildGoal({ text: '' }),
        compact: false,
      });

      // Should not have expand toggle for empty content
      expect(screen.queryByText('Goal description')).not.toBeInTheDocument();
    });

    it('expands content when expand button clicked', () => {
      renderCard({
        goal: buildGoal({ text: '<p>Goal description</p>' }),
        compact: false,
      });

      // Find and click the expand button (the last button with chevron)
      const buttons = screen.getAllByRole('button');
      const expandButton = buttons[buttons.length - 1];
      fireEvent.click(expandButton);

      // Content should now be visible
      expect(screen.getByText('Goal description')).toBeInTheDocument();
    });
  });

  describe('Inline Editing', () => {
    it('enters edit mode when content clicked with editable=true', () => {
      renderCard({
        goal: buildGoal({ text: '<p>Editable content</p>' }),
        editable: true,
        compact: false,
      });

      // First expand the content
      const buttons = screen.getAllByRole('button');
      const expandButton = buttons[buttons.length - 1];
      fireEvent.click(expandButton);

      // Click on the content
      const content = screen.getByText('Editable content');
      fireEvent.click(content);

      // Should show editor
      expect(screen.getByTestId('simple-rich-text-editor')).toBeInTheDocument();
    });

    it('saves edited content when save clicked', () => {
      const onUpdate = vi.fn();
      renderCard({
        goal: buildGoal({ id: 1, text: '<p>Original</p>' }),
        editable: true,
        onUpdate,
        compact: false,
      });

      // Expand content
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[buttons.length - 1]);

      // Enter edit mode
      fireEvent.click(screen.getByText('Original'));

      // Edit content
      fireEvent.change(screen.getByTestId('simple-rich-text-editor'), {
        target: { value: '<p>Updated</p>' },
      });

      // Save
      fireEvent.click(screen.getByText('Save'));

      expect(onUpdate).toHaveBeenCalledWith(1, { text: '<p>Updated</p>' });
    });

    it('cancels edit and restores content when cancel clicked', () => {
      renderCard({
        goal: buildGoal({ text: '<p>Original</p>' }),
        editable: true,
        compact: false,
      });

      // Expand and enter edit mode
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[buttons.length - 1]);
      fireEvent.click(screen.getByText('Original'));

      // Edit then cancel
      fireEvent.change(screen.getByTestId('simple-rich-text-editor'), {
        target: { value: '<p>Changed</p>' },
      });
      fireEvent.click(screen.getByText('Cancel'));

      // Should show original content again
      expect(screen.getByText('Original')).toBeInTheDocument();
    });
  });

  describe('Goal Type Badges', () => {
    it('applies info color for time-based goals', () => {
      renderCard({ goal: buildGoal({ goal_type: 'Weekly' }) });

      expect(screen.getByText('Weekly')).toBeInTheDocument();
    });

    it('applies success color for lifestyle goals', () => {
      renderCard({ goal: buildGoal({ goal_type: 'Fitness' }) });

      expect(screen.getByText('Fitness')).toBeInTheDocument();
    });

    it('applies accent color for custom goals', () => {
      renderCard({ goal: buildGoal({ goal_type: 'Custom:MyType' }) });

      expect(screen.getByText('MyType')).toBeInTheDocument();
    });
  });

  describe('Not Started Goals', () => {
    it('shows days until start for future goals', () => {
      renderCard({
        goal: buildGoal({ start_date: '2025-11-20' }),
        viewedDate: '2025-11-10',
      });

      expect(screen.getByText('10 days until start')).toBeInTheDocument();
    });
  });
});
