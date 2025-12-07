/**
 * ListColumn Component Tests
 *
 * Tests for the ListColumn component used in Lists and Kanban views.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ListColumn from '@/components/ListColumn';
import type { List, NoteEntry, ListWithEntries } from '@/types';

const mockListsApi = vi.hoisted(() => ({
  update: vi.fn(),
  addEntry: vi.fn(),
  removeEntry: vi.fn(),
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

vi.mock('@/components/ListCard', () => ({
  default: ({ entry, onRemoveFromList }: { entry: NoteEntry; onRemoveFromList: (id: number) => void }) => (
    <div data-testid={`list-card-${entry.id}`}>
      <span>{entry.title}</span>
      <button onClick={() => onRemoveFromList(entry.id)} data-testid={`remove-card-${entry.id}`}>
        Remove
      </button>
    </div>
  ),
}));

vi.mock('@/components/LabelSelector', () => ({
  default: () => <div data-testid="label-selector">Labels</div>,
}));

vi.mock('@/components/AddEntryToListModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="add-entry-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('@/components/CreateEntryModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="create-entry-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

const buildList = (overrides: Partial<List> = {}): List => ({
  id: 1,
  name: 'Test List',
  description: 'Test description',
  color: '#3b82f6',
  order_index: 0,
  is_archived: false,
  is_kanban: false,
  kanban_order: 0,
  created_at: '2025-11-07T12:00:00Z',
  updated_at: '2025-11-07T12:00:00Z',
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
  created_at: '2025-11-07T12:00:00Z',
  updated_at: '2025-11-07T12:00:00Z',
  labels: [],
  include_in_report: false,
  is_important: false,
  is_completed: false,
  is_pinned: false,
  ...overrides,
});

describe('ListColumn', () => {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  const onDragStart = vi.fn();
  const onDragEnd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    mockListsApi.update.mockResolvedValue({});
    mockListsApi.addEntry.mockResolvedValue({});
    mockListsApi.removeEntry.mockResolvedValue({});
  });

  const renderColumn = (props: Partial<Parameters<typeof ListColumn>[0]> = {}) => {
    const defaultProps = {
      list: buildList(),
      entries: [],
      onUpdate,
      onDelete,
      onDragStart,
      onDragEnd,
    };
    return render(<ListColumn {...defaultProps} {...props} />);
  };

  describe('Rendering', () => {
    it('renders list name and card count', () => {
      renderColumn({
        list: buildList({ name: 'My List' }),
        entries: [buildEntry(1), buildEntry(2)],
      });

      expect(screen.getByText('My List')).toBeInTheDocument();
      expect(screen.getByText('2 cards')).toBeInTheDocument();
    });

    it('shows singular "card" for one entry', () => {
      renderColumn({
        entries: [buildEntry(1)],
      });

      expect(screen.getByText('1 card')).toBeInTheDocument();
    });

    it('shows empty state when no entries', () => {
      renderColumn({ entries: [] });

      expect(screen.getByText('No cards yet')).toBeInTheDocument();
      expect(screen.getByText('Drag cards here or add from daily notes')).toBeInTheDocument();
    });

    it('renders all entry cards', () => {
      renderColumn({
        entries: [
          buildEntry(1, { title: 'Task A' }),
          buildEntry(2, { title: 'Task B' }),
          buildEntry(3, { title: 'Task C' }),
        ],
      });

      expect(screen.getByText('Task A')).toBeInTheDocument();
      expect(screen.getByText('Task B')).toBeInTheDocument();
      expect(screen.getByText('Task C')).toBeInTheDocument();
    });

    it('renders label selector', () => {
      renderColumn();

      expect(screen.getByTestId('label-selector')).toBeInTheDocument();
    });
  });

  describe('Name Editing', () => {
    it('enters edit mode when pencil button clicked', () => {
      renderColumn({ list: buildList({ name: 'Original Name' }) });

      fireEvent.click(screen.getByTitle('Edit name'));

      expect(screen.getByDisplayValue('Original Name')).toBeInTheDocument();
    });

    it('saves name on Enter key', async () => {
      renderColumn({ list: buildList({ id: 1, name: 'Original' }) });

      fireEvent.click(screen.getByTitle('Edit name'));
      
      const input = screen.getByDisplayValue('Original');
      fireEvent.change(input, { target: { value: 'Updated Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockListsApi.update).toHaveBeenCalledWith(1, { name: 'Updated Name' });
      });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('cancels edit on Escape key', () => {
      renderColumn({ list: buildList({ name: 'Original' }) });

      fireEvent.click(screen.getByTitle('Edit name'));
      
      const input = screen.getByDisplayValue('Original');
      fireEvent.change(input, { target: { value: 'Changed' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      // Should exit edit mode and show original name
      expect(screen.getByText('Original')).toBeInTheDocument();
      expect(mockListsApi.update).not.toHaveBeenCalled();
    });

    it('saves name when save button clicked', async () => {
      renderColumn({ list: buildList({ id: 2, name: 'Old Name' }) });

      fireEvent.click(screen.getByTitle('Edit name'));
      
      const input = screen.getByDisplayValue('Old Name');
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.click(screen.getByTitle('Save'));

      await waitFor(() => {
        expect(mockListsApi.update).toHaveBeenCalledWith(2, { name: 'New Name' });
      });
    });

    it('cancels edit when cancel button clicked', () => {
      renderColumn({ list: buildList({ name: 'Original' }) });

      fireEvent.click(screen.getByTitle('Edit name'));
      fireEvent.change(screen.getByDisplayValue('Original'), { target: { value: 'Changed' } });
      fireEvent.click(screen.getByTitle('Cancel'));

      expect(screen.getByText('Original')).toBeInTheDocument();
    });

    it('shows alert when name is empty', async () => {
      renderColumn({ list: buildList({ name: 'Original' }) });

      fireEvent.click(screen.getByTitle('Edit name'));
      
      const input = screen.getByDisplayValue('Original');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.click(screen.getByTitle('Save'));

      expect(window.alert).toHaveBeenCalledWith('List name cannot be empty');
      expect(mockListsApi.update).not.toHaveBeenCalled();
    });

    it('does not call API if name unchanged', async () => {
      renderColumn({ list: buildList({ name: 'Same Name' }) });

      fireEvent.click(screen.getByTitle('Edit name'));
      fireEvent.click(screen.getByTitle('Save'));

      expect(mockListsApi.update).not.toHaveBeenCalled();
    });
  });

  describe('Card Management', () => {
    it('opens add entry modal when add button clicked', () => {
      renderColumn();

      fireEvent.click(screen.getByTitle('Add existing cards'));

      expect(screen.getByTestId('add-entry-modal')).toBeInTheDocument();
    });

    it('opens create entry modal when create button clicked', () => {
      renderColumn();

      fireEvent.click(screen.getByTitle('Create new card'));

      expect(screen.getByTestId('create-entry-modal')).toBeInTheDocument();
    });

    it('removes entry when remove button clicked', async () => {
      renderColumn({
        list: buildList({ id: 1 }),
        entries: [buildEntry(5)],
      });

      fireEvent.click(screen.getByTestId('remove-card-5'));

      await waitFor(() => {
        expect(mockListsApi.removeEntry).toHaveBeenCalledWith(1, 5);
      });
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  describe('Archive and Delete', () => {
    it('archives list when archive button clicked', async () => {
      renderColumn({ list: buildList({ id: 3, is_archived: false }) });

      fireEvent.click(screen.getByTitle('Archive'));

      await waitFor(() => {
        expect(mockListsApi.update).toHaveBeenCalledWith(3, { is_archived: true });
      });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('unarchives list when archive button clicked on archived list', async () => {
      renderColumn({ list: buildList({ id: 4, is_archived: true }) });

      fireEvent.click(screen.getByTitle('Unarchive'));

      await waitFor(() => {
        expect(mockListsApi.update).toHaveBeenCalledWith(4, { is_archived: false });
      });
    });

    it('calls onDelete when delete button clicked', () => {
      renderColumn({ list: buildList({ id: 5, name: 'To Delete' }) });

      fireEvent.click(screen.getByTitle('Delete'));

      expect(onDelete).toHaveBeenCalledWith(5, 'To Delete');
    });
  });

  describe('Drag and Drop', () => {
    it('calls onDragStart when header drag starts', () => {
      renderColumn({ list: buildList({ id: 1 }) });

      const header = screen.getByTestId('list-header-1');
      
      fireEvent.dragStart(header, {
        dataTransfer: {
          setData: vi.fn(),
          effectAllowed: 'move',
        },
      });

      expect(onDragStart).toHaveBeenCalled();
    });

    it('calls onDragEnd when header drag ends', () => {
      renderColumn({ list: buildList({ id: 1 }) });

      const header = screen.getByTestId('list-header-1');
      
      fireEvent.dragEnd(header);

      expect(onDragEnd).toHaveBeenCalled();
    });

    it('handles entry drop from another list', async () => {
      renderColumn({ list: buildList({ id: 2 }) });

      const column = screen.getByTestId('list-column-2');
      
      // Simulate drop event with entry data
      fireEvent.drop(column, {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: {
          types: ['text/x-entryid', 'text/x-sourcelistid'],
          getData: (type: string) => {
            if (type === 'text/x-entryid') return '10';
            if (type === 'text/x-sourcelistid') return '1';
            return '';
          },
        },
      });

      await waitFor(() => {
        expect(mockListsApi.removeEntry).toHaveBeenCalledWith(1, 10);
        expect(mockListsApi.addEntry).toHaveBeenCalledWith(2, 10);
      });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('does not move entry if dropped on same list', async () => {
      renderColumn({ list: buildList({ id: 3 }) });

      const column = screen.getByTestId('list-column-3');
      
      fireEvent.drop(column, {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: {
          types: ['text/x-entryid', 'text/x-sourcelistid'],
          getData: (type: string) => {
            if (type === 'text/x-entryid') return '10';
            if (type === 'text/x-sourcelistid') return '3'; // Same list
            return '';
          },
        },
      });

      expect(mockListsApi.removeEntry).not.toHaveBeenCalled();
      expect(mockListsApi.addEntry).not.toHaveBeenCalled();
    });
  });

  describe('Kanban View', () => {
    it('applies kanban texture styles when isKanbanView is true', () => {
      renderColumn({ isKanbanView: true });

      // Component should render without errors
      expect(screen.getByText('Test List')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows alert when name update fails', async () => {
      mockListsApi.update.mockRejectedValue({
        response: { data: { detail: 'Update failed' } },
      });

      renderColumn({ list: buildList({ name: 'Original' }) });

      fireEvent.click(screen.getByTitle('Edit name'));
      const input = screen.getByDisplayValue('Original');
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.click(screen.getByTitle('Save'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Update failed');
      });
    });

    it('shows alert when entry removal fails', async () => {
      mockListsApi.removeEntry.mockRejectedValue({
        response: { data: { detail: 'Remove failed' } },
      });

      renderColumn({
        entries: [buildEntry(1)],
      });

      fireEvent.click(screen.getByTestId('remove-card-1'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Remove failed');
      });
    });
  });
});

