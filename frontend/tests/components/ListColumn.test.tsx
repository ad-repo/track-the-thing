/**
 * ListColumn Component Tests
 *
 * Tests for Kanban/List column including:
 * - Rendering list header with name and color
 * - Entry count display
 * - Empty state
 * - Name editing functionality
 * - Action buttons
 * - Archive toggle
 * - Delete callback
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ListColumn from '@/components/ListColumn';
import type { List, NoteEntry, Label } from '@/types';

const mockListsApi = vi.hoisted(() => ({
  update: vi.fn(),
  removeEntry: vi.fn(),
  addEntry: vi.fn(),
  addLabel: vi.fn(),
  removeLabel: vi.fn(),
}));

vi.mock('@/api', () => ({
  __esModule: true,
  listsApi: mockListsApi,
}));

vi.mock('@/hooks/useTexture', () => ({
  useTexture: () => ({}),
}));

// Mock ListCard
vi.mock('@/components/ListCard', () => ({
  default: ({ entry, onRemoveFromList }: { entry: NoteEntry; onRemoveFromList: (id: number) => void }) => (
    <div data-testid={`list-card-${entry.id}`}>
      <span>{entry.title}</span>
      <button onClick={() => onRemoveFromList(entry.id)} data-testid={`remove-${entry.id}`}>Remove</button>
    </div>
  ),
}));

// Mock AddEntryToListModal
vi.mock('@/components/AddEntryToListModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="add-entry-modal">
      <button onClick={onClose}>Close Add Modal</button>
    </div>
  ),
}));

// Mock CreateEntryModal
vi.mock('@/components/CreateEntryModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="create-entry-modal">
      <button onClick={onClose}>Close Create Modal</button>
    </div>
  ),
}));

// Mock LabelSelector
vi.mock('@/components/LabelSelector', () => ({
  default: () => <div data-testid="label-selector">Labels</div>,
}));

const buildList = (overrides: Partial<List> = {}): List => ({
  id: 1,
  name: 'Test List',
  description: '',
  color: '#3b82f6',
  order_index: 0,
  is_archived: false,
  is_kanban: false,
  kanban_order: 0,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  labels: [],
  ...overrides,
});

const buildEntry = (id: number, overrides: Partial<NoteEntry> = {}): NoteEntry => ({
  id,
  daily_note_id: 1,
  title: `Entry ${id}`,
  content: `<p>Content ${id}</p>`,
  content_type: 'rich_text',
  order_index: id - 1,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  labels: [],
  include_in_report: false,
  is_important: false,
  is_completed: false,
  is_pinned: false,
  ...overrides,
});

describe('ListColumn', () => {
  const mockOnUpdate = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnDragStart = vi.fn();
  const mockOnDragEnd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  const renderListColumn = (props: Partial<Parameters<typeof ListColumn>[0]> = {}) => {
    return render(
      <ListColumn
        list={buildList()}
        entries={[]}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        {...props}
      />
    );
  };

  describe('Basic Rendering', () => {
    it('renders list name', () => {
      renderListColumn({ list: buildList({ name: 'My List' }) });

      expect(screen.getByText('My List')).toBeInTheDocument();
    });

    it('displays entry count', () => {
      renderListColumn({
        entries: [buildEntry(1), buildEntry(2), buildEntry(3)],
      });

      expect(screen.getByText('3 cards')).toBeInTheDocument();
    });

    it('displays singular "card" for single entry', () => {
      renderListColumn({
        entries: [buildEntry(1)],
      });

      expect(screen.getByText('1 card')).toBeInTheDocument();
    });

    it('renders entries', () => {
      renderListColumn({
        entries: [buildEntry(1), buildEntry(2)],
      });

      expect(screen.getByTestId('list-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('list-card-2')).toBeInTheDocument();
    });

    it('renders label selector', () => {
      renderListColumn();

      expect(screen.getByTestId('label-selector')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no entries', () => {
      renderListColumn({ entries: [] });

      expect(screen.getByText('No cards yet')).toBeInTheDocument();
      expect(screen.getByText('Drag cards here or add from daily notes')).toBeInTheDocument();
    });
  });

  describe('Name Editing', () => {
    it('shows edit button', () => {
      renderListColumn();

      expect(screen.getByTitle('Edit name')).toBeInTheDocument();
    });

    it('enters edit mode when edit button is clicked', () => {
      renderListColumn({ list: buildList({ name: 'Original Name' }) });

      fireEvent.click(screen.getByTitle('Edit name'));

      const input = screen.getByDisplayValue('Original Name');
      expect(input).toBeInTheDocument();
      expect(screen.getByTitle('Save')).toBeInTheDocument();
      expect(screen.getByTitle('Cancel')).toBeInTheDocument();
    });

    it('saves name when Save button is clicked', async () => {
      mockListsApi.update.mockResolvedValue({});
      renderListColumn({ list: buildList({ id: 1, name: 'Original Name' }) });

      fireEvent.click(screen.getByTitle('Edit name'));
      
      const input = screen.getByDisplayValue('Original Name');
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.click(screen.getByTitle('Save'));

      await waitFor(() => {
        expect(mockListsApi.update).toHaveBeenCalledWith(1, { name: 'New Name' });
      });
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('saves name when Enter is pressed', async () => {
      mockListsApi.update.mockResolvedValue({});
      renderListColumn({ list: buildList({ id: 1, name: 'Original Name' }) });

      fireEvent.click(screen.getByTitle('Edit name'));
      
      const input = screen.getByDisplayValue('Original Name');
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockListsApi.update).toHaveBeenCalledWith(1, { name: 'New Name' });
      });
    });

    it('cancels edit when Cancel button is clicked', () => {
      renderListColumn({ list: buildList({ name: 'Original Name' }) });

      fireEvent.click(screen.getByTitle('Edit name'));
      
      const input = screen.getByDisplayValue('Original Name');
      fireEvent.change(input, { target: { value: 'Changed' } });
      fireEvent.click(screen.getByTitle('Cancel'));

      // Should be back to display mode
      expect(screen.getByText('Original Name')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Changed')).not.toBeInTheDocument();
    });

    it('cancels edit when Escape is pressed', () => {
      renderListColumn({ list: buildList({ name: 'Original Name' }) });

      fireEvent.click(screen.getByTitle('Edit name'));
      
      const input = screen.getByDisplayValue('Original Name');
      fireEvent.change(input, { target: { value: 'Changed' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      // Should be back to display mode
      expect(screen.getByText('Original Name')).toBeInTheDocument();
    });

    it('shows alert when trying to save empty name', async () => {
      renderListColumn({ list: buildList({ name: 'Original Name' }) });

      fireEvent.click(screen.getByTitle('Edit name'));
      
      const input = screen.getByDisplayValue('Original Name');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.click(screen.getByTitle('Save'));

      expect(window.alert).toHaveBeenCalledWith('List name cannot be empty');
      expect(mockListsApi.update).not.toHaveBeenCalled();
    });

    it('does not call API if name unchanged', async () => {
      renderListColumn({ list: buildList({ name: 'Original Name' }) });

      fireEvent.click(screen.getByTitle('Edit name'));
      fireEvent.click(screen.getByTitle('Save'));

      expect(mockListsApi.update).not.toHaveBeenCalled();
    });
  });

  describe('Action Buttons', () => {
    it('shows create new card button', () => {
      renderListColumn();

      expect(screen.getByTitle('Create new card')).toBeInTheDocument();
    });

    it('opens create modal when create button is clicked', () => {
      renderListColumn();

      fireEvent.click(screen.getByTitle('Create new card'));

      expect(screen.getByTestId('create-entry-modal')).toBeInTheDocument();
    });

    it('shows add existing cards button', () => {
      renderListColumn();

      expect(screen.getByTitle('Add existing cards')).toBeInTheDocument();
    });

    it('opens add modal when add button is clicked', () => {
      renderListColumn();

      fireEvent.click(screen.getByTitle('Add existing cards'));

      expect(screen.getByTestId('add-entry-modal')).toBeInTheDocument();
    });

    it('shows archive button', () => {
      renderListColumn();

      expect(screen.getByTitle('Archive')).toBeInTheDocument();
    });

    it('shows delete button', () => {
      renderListColumn();

      expect(screen.getByTitle('Delete')).toBeInTheDocument();
    });
  });

  describe('Archive Functionality', () => {
    it('calls listsApi.update with is_archived when archive button is clicked', async () => {
      mockListsApi.update.mockResolvedValue({});
      renderListColumn({ list: buildList({ id: 1, is_archived: false }) });

      fireEvent.click(screen.getByTitle('Archive'));

      await waitFor(() => {
        expect(mockListsApi.update).toHaveBeenCalledWith(1, { is_archived: true });
      });
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('shows Unarchive title when list is archived', () => {
      renderListColumn({ list: buildList({ is_archived: true }) });

      expect(screen.getByTitle('Unarchive')).toBeInTheDocument();
    });
  });

  describe('Delete Functionality', () => {
    it('calls onDelete when delete button is clicked', () => {
      renderListColumn({ list: buildList({ id: 1, name: 'Test List' }) });

      fireEvent.click(screen.getByTitle('Delete'));

      expect(mockOnDelete).toHaveBeenCalledWith(1, 'Test List');
    });
  });

  describe('Remove Entry from List', () => {
    it('removes entry when remove button is clicked', async () => {
      mockListsApi.removeEntry.mockResolvedValue({});
      renderListColumn({
        list: buildList({ id: 1 }),
        entries: [buildEntry(1)],
      });

      fireEvent.click(screen.getByTestId('remove-1'));

      await waitFor(() => {
        expect(mockListsApi.removeEntry).toHaveBeenCalledWith(1, 1);
      });
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  describe('Drag and Drop Events', () => {
    it('fires onDragStart when header drag starts', () => {
      renderListColumn({
        list: buildList({ id: 1 }),
        onDragStart: mockOnDragStart,
      });

      const header = screen.getByTestId('list-header-1');
      const mockDataTransfer = {
        setData: vi.fn(),
        effectAllowed: '',
      };
      
      fireEvent.dragStart(header, { dataTransfer: mockDataTransfer });

      expect(mockOnDragStart).toHaveBeenCalled();
      expect(mockDataTransfer.setData).toHaveBeenCalledWith('text/x-listid', '1');
    });

    it('fires onDragEnd when header drag ends', () => {
      renderListColumn({
        list: buildList({ id: 1 }),
        onDragEnd: mockOnDragEnd,
      });

      const header = screen.getByTestId('list-header-1');
      
      fireEvent.dragEnd(header);

      expect(mockOnDragEnd).toHaveBeenCalled();
    });
  });

  describe('Modal Close', () => {
    it('closes add modal when close is called', () => {
      renderListColumn();

      fireEvent.click(screen.getByTitle('Add existing cards'));
      expect(screen.getByTestId('add-entry-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Close Add Modal'));
      expect(screen.queryByTestId('add-entry-modal')).not.toBeInTheDocument();
    });

    it('closes create modal when close is called', () => {
      renderListColumn();

      fireEvent.click(screen.getByTitle('Create new card'));
      expect(screen.getByTestId('create-entry-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Close Create Modal'));
      expect(screen.queryByTestId('create-entry-modal')).not.toBeInTheDocument();
    });
  });

  describe('Kanban View', () => {
    it('applies kanban texture when isKanbanView is true', () => {
      renderListColumn({ isKanbanView: true });

      // The component should render - texture hook is mocked
      expect(screen.getByTestId('list-column-1')).toBeInTheDocument();
    });
  });
});

