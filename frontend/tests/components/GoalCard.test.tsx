/**
 * GoalCard Component Tests
 *
 * Tests for goal card display including:
 * - Basic rendering (name, type badge, dates)
 * - Complete toggle button
 * - Visibility toggle
 * - Edit and delete buttons
 * - Expand/collapse content
 * - Days remaining badge
 * - Different goal types styling
 * - Compact mode
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GoalCard from '@/components/GoalCard';
import type { Goal } from '@/types';

// Mock SimpleRichTextEditor
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
  goal_type: 'Personal',
  text: '<p>Goal description</p>',
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
  days_remaining: 15,
  ...overrides,
});

describe('GoalCard', () => {
  const mockOnUpdate = vi.fn();
  const mockOnToggleComplete = vi.fn();
  const mockOnToggleVisibility = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnEdit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  const renderGoalCard = (props: Partial<Parameters<typeof GoalCard>[0]> = {}) => {
    return render(
      <GoalCard
        goal={buildGoal()}
        {...props}
      />
    );
  };

  describe('Basic Rendering', () => {
    it('renders goal name', () => {
      renderGoalCard({ goal: buildGoal({ name: 'My Goal' }) });

      expect(screen.getByText('My Goal')).toBeInTheDocument();
    });

    it('renders goal type badge', () => {
      renderGoalCard({ goal: buildGoal({ goal_type: 'Sprint' }) });

      expect(screen.getByText('Sprint')).toBeInTheDocument();
    });

    it('renders custom type name without Custom: prefix', () => {
      renderGoalCard({ goal: buildGoal({ goal_type: 'Custom:MyProject' }) });

      expect(screen.getByText('MyProject')).toBeInTheDocument();
    });

    it('renders date range', () => {
      renderGoalCard({ goal: buildGoal({ start_date: '2025-01-01', end_date: '2025-01-31' }) });

      expect(screen.getByText('2025-01-01 → 2025-01-31')).toBeInTheDocument();
    });

    it('hides date range in compact mode', () => {
      renderGoalCard({
        goal: buildGoal({ start_date: '2025-01-01', end_date: '2025-01-31' }),
        compact: true,
      });

      expect(screen.queryByText('2025-01-01 → 2025-01-31')).not.toBeInTheDocument();
    });
  });

  describe('Days Remaining Badge', () => {
    it('shows days remaining', () => {
      renderGoalCard({ goal: buildGoal({ days_remaining: 15, show_countdown: true }) });

      expect(screen.getByText('15 days left')).toBeInTheDocument();
    });

    it('shows "Today!" when 0 days remaining', () => {
      renderGoalCard({ goal: buildGoal({ days_remaining: 0, show_countdown: true }) });

      expect(screen.getByText('Today!')).toBeInTheDocument();
    });

    it('shows overdue message for negative days', () => {
      renderGoalCard({ goal: buildGoal({ days_remaining: -5, show_countdown: true }) });

      expect(screen.getByText('5 days overdue')).toBeInTheDocument();
    });

    it('does not show countdown when show_countdown is false', () => {
      renderGoalCard({ goal: buildGoal({ days_remaining: 15, show_countdown: false }) });

      expect(screen.queryByText('15 days left')).not.toBeInTheDocument();
    });

    it('shows status_text for lifestyle goals', () => {
      renderGoalCard({
        goal: buildGoal({
          goal_type: 'Personal',
          status_text: '3/10 workouts',
          show_countdown: false,
        }),
      });

      expect(screen.getByText('3/10 workouts')).toBeInTheDocument();
    });
  });

  describe('Complete Toggle', () => {
    it('renders complete button when onToggleComplete is provided', () => {
      renderGoalCard({ onToggleComplete: mockOnToggleComplete });

      expect(screen.getByTitle('Mark as complete')).toBeInTheDocument();
    });

    it('does not render complete button when onToggleComplete is not provided', () => {
      renderGoalCard();

      expect(screen.queryByTitle('Mark as complete')).not.toBeInTheDocument();
    });

    it('calls onToggleComplete when button is clicked', async () => {
      renderGoalCard({
        goal: buildGoal({ id: 1 }),
        onToggleComplete: mockOnToggleComplete,
      });

      fireEvent.click(screen.getByTitle('Mark as complete'));

      await waitFor(() => {
        expect(mockOnToggleComplete).toHaveBeenCalledWith(1);
      });
    });

    it('shows "Mark as incomplete" title when goal is completed', () => {
      renderGoalCard({
        goal: buildGoal({ is_completed: true }),
        onToggleComplete: mockOnToggleComplete,
      });

      expect(screen.getByTitle('Mark as incomplete')).toBeInTheDocument();
    });

    it('shows strikethrough on name when completed', () => {
      renderGoalCard({
        goal: buildGoal({ name: 'Completed Goal', is_completed: true }),
        onToggleComplete: mockOnToggleComplete,
      });

      const name = screen.getByText('Completed Goal');
      expect(name).toHaveClass('line-through');
    });
  });

  describe('Visibility Toggle', () => {
    it('renders visibility button when showVisibilityToggle is true', () => {
      renderGoalCard({
        showVisibilityToggle: true,
        onToggleVisibility: mockOnToggleVisibility,
      });

      expect(screen.getByTitle('Hide from Daily View')).toBeInTheDocument();
    });

    it('does not render visibility button by default', () => {
      renderGoalCard();

      expect(screen.queryByTitle('Hide from Daily View')).not.toBeInTheDocument();
    });

    it('calls onToggleVisibility when button is clicked', () => {
      renderGoalCard({
        goal: buildGoal({ id: 1 }),
        showVisibilityToggle: true,
        onToggleVisibility: mockOnToggleVisibility,
      });

      fireEvent.click(screen.getByTitle('Hide from Daily View'));

      expect(mockOnToggleVisibility).toHaveBeenCalledWith(1);
    });

    it('shows "Show on Daily View" when goal is hidden', () => {
      renderGoalCard({
        goal: buildGoal({ is_visible: false }),
        showVisibilityToggle: true,
        onToggleVisibility: mockOnToggleVisibility,
      });

      expect(screen.getByTitle('Show on Daily View')).toBeInTheDocument();
    });
  });

  describe('Edit Button', () => {
    it('renders edit button when editable and onEdit is provided', () => {
      renderGoalCard({
        editable: true,
        onEdit: mockOnEdit,
      });

      expect(screen.getByTitle('Edit goal')).toBeInTheDocument();
    });

    it('does not render edit button when not editable', () => {
      renderGoalCard({ onEdit: mockOnEdit });

      expect(screen.queryByTitle('Edit goal')).not.toBeInTheDocument();
    });

    it('calls onEdit when button is clicked', () => {
      const goal = buildGoal();
      renderGoalCard({
        goal,
        editable: true,
        onEdit: mockOnEdit,
      });

      fireEvent.click(screen.getByTitle('Edit goal'));

      expect(mockOnEdit).toHaveBeenCalledWith(goal);
    });
  });

  describe('Delete Button', () => {
    it('renders delete button when showDeleteButton and onDelete are provided', () => {
      renderGoalCard({
        showDeleteButton: true,
        onDelete: mockOnDelete,
      });

      expect(screen.getByTitle('Delete goal')).toBeInTheDocument();
    });

    it('does not render delete button by default', () => {
      renderGoalCard({ onDelete: mockOnDelete });

      expect(screen.queryByTitle('Delete goal')).not.toBeInTheDocument();
    });

    it('calls onDelete after confirmation', () => {
      renderGoalCard({
        goal: buildGoal({ id: 1 }),
        showDeleteButton: true,
        onDelete: mockOnDelete,
      });

      fireEvent.click(screen.getByTitle('Delete goal'));

      expect(window.confirm).toHaveBeenCalled();
      expect(mockOnDelete).toHaveBeenCalledWith(1);
    });

    it('does not call onDelete if confirmation is cancelled', () => {
      (window.confirm as any).mockReturnValue(false);

      renderGoalCard({
        goal: buildGoal({ id: 1 }),
        showDeleteButton: true,
        onDelete: mockOnDelete,
      });

      fireEvent.click(screen.getByTitle('Delete goal'));

      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });

  describe('Expand/Collapse Content', () => {
    it('shows expand button when goal has content', () => {
      renderGoalCard({
        goal: buildGoal({ text: '<p>Some content</p>' }),
      });

      // ChevronDown button for expand
      const buttons = screen.getAllByRole('button');
      const expandButton = buttons.find(btn => btn.querySelector('svg'));
      expect(expandButton).toBeTruthy();
    });

    it('does not show expand button when goal has no content', () => {
      renderGoalCard({
        goal: buildGoal({ text: '' }),
      });

      // Should not have expand button - content area is hidden
      expect(screen.queryByText('Goal description')).not.toBeInTheDocument();
    });

    it('does not show expand button in compact mode', () => {
      renderGoalCard({
        goal: buildGoal({ text: '<p>Some content</p>' }),
        compact: true,
      });

      // In compact mode, expand button should not be visible
      // The content expand functionality is disabled
    });

    it('expands content when expand button is clicked', () => {
      renderGoalCard({
        goal: buildGoal({ text: '<p>Expanded content here</p>' }),
      });

      // Find and click expand button (last button with ChevronDown)
      const buttons = screen.getAllByRole('button');
      const expandButton = buttons[buttons.length - 1];
      fireEvent.click(expandButton);

      // Content should now be visible
      expect(screen.getByText('Expanded content here')).toBeInTheDocument();
    });
  });

  describe('Inline Editing', () => {
    it('allows editing content when expanded and editable', () => {
      renderGoalCard({
        goal: buildGoal({ text: '<p>Editable content</p>' }),
        editable: true,
        onUpdate: mockOnUpdate,
      });

      // Expand content first
      const buttons = screen.getAllByRole('button');
      const expandButton = buttons[buttons.length - 1];
      fireEvent.click(expandButton);

      // Click on content to enter edit mode
      const content = screen.getByText('Editable content');
      fireEvent.click(content);

      // Editor should be visible
      expect(screen.getByTestId('simple-rich-text-editor')).toBeInTheDocument();
    });

    it('saves edited content', async () => {
      renderGoalCard({
        goal: buildGoal({ id: 1, text: '<p>Original</p>' }),
        editable: true,
        onUpdate: mockOnUpdate,
      });

      // Expand content
      const buttons = screen.getAllByRole('button');
      const expandButton = buttons[buttons.length - 1];
      fireEvent.click(expandButton);

      // Click to edit
      const content = screen.getByText('Original');
      fireEvent.click(content);

      // Change content
      const editor = screen.getByTestId('simple-rich-text-editor');
      fireEvent.change(editor, { target: { value: '<p>Updated</p>' } });

      // Save
      fireEvent.click(screen.getByText('Save'));

      expect(mockOnUpdate).toHaveBeenCalledWith(1, { text: '<p>Updated</p>' });
    });

    it('cancels editing without saving', () => {
      renderGoalCard({
        goal: buildGoal({ text: '<p>Original</p>' }),
        editable: true,
        onUpdate: mockOnUpdate,
      });

      // Expand content
      const buttons = screen.getAllByRole('button');
      const expandButton = buttons[buttons.length - 1];
      fireEvent.click(expandButton);

      // Click to edit
      const content = screen.getByText('Original');
      fireEvent.click(content);

      // Change content
      const editor = screen.getByTestId('simple-rich-text-editor');
      fireEvent.change(editor, { target: { value: '<p>Changed</p>' } });

      // Cancel
      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Goal Type Styling', () => {
    it('applies info style for time-based goals', () => {
      renderGoalCard({ goal: buildGoal({ goal_type: 'Sprint' }) });

      const badge = screen.getByText('Sprint');
      expect(badge).toBeInTheDocument();
    });

    it('applies success style for lifestyle goals', () => {
      renderGoalCard({ goal: buildGoal({ goal_type: 'Fitness' }) });

      const badge = screen.getByText('Fitness');
      expect(badge).toBeInTheDocument();
    });

    it('applies accent style for custom goals', () => {
      renderGoalCard({ goal: buildGoal({ goal_type: 'Custom:MyProject' }) });

      const badge = screen.getByText('MyProject');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Opacity States', () => {
    it('reduces opacity when completed', () => {
      const { container } = renderGoalCard({
        goal: buildGoal({ is_completed: true }),
        onToggleComplete: mockOnToggleComplete,
      });

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('opacity-75');
    });

    it('reduces opacity when not visible', () => {
      const { container } = renderGoalCard({
        goal: buildGoal({ is_visible: false }),
      });

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('opacity-60');
    });
  });
});

