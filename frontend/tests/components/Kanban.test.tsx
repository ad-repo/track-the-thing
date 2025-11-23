import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Kanban from '@/components/Kanban';
import type { ListWithEntries, List } from '@/types';

const mockKanbanApi = vi.hoisted(() => ({
  getBoards: vi.fn(),
  initialize: vi.fn(),
  reorderColumns: vi.fn(),
}));

const mockListsApi = vi.hoisted(() => ({
  create: vi.fn(),
  getById: vi.fn(),
  addEntry: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/api', () => ({
  __esModule: true,
  kanbanApi: mockKanbanApi,
  listsApi: mockListsApi,
}));

vi.mock('@/components/ListColumn', () => ({
  __esModule: true,
  default: ({ list }: { list: ListWithEntries }) => <div data-testid={`kanban-column-${list.id}`}>{list.name}</div>,
}));

const buildList = (id: number, overrides: Partial<ListWithEntries> = {}): ListWithEntries => ({
  id,
  name: `Column ${id}`,
  description: '',
  color: '#3b82f6',
  order_index: id - 1,
  is_archived: false,
  entries: [],
  is_kanban: true,
  kanban_order: id - 1,
  created_at: '',
  updated_at: '',
  labels: [],
  ...overrides,
});

describe('Kanban', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKanbanApi.getBoards.mockResolvedValue([buildList(1), buildList(2)]);
    mockListsApi.create.mockResolvedValue(buildList(3));
  });

  const renderKanban = () => render(<Kanban />);

  it('loads kanban boards on mount', async () => {
    renderKanban();

    await waitFor(() => expect(mockKanbanApi.getBoards).toHaveBeenCalled());
    expect(screen.getByTestId('kanban-column-1')).toHaveTextContent('Column 1');
  });

  it('creates a new column through the modal', async () => {
    renderKanban();
    await screen.findByTestId('kanban-column-1');

    fireEvent.click(screen.getByTitle('Create New Column'));
    fireEvent.change(screen.getByPlaceholderText(/blocked/i), { target: { value: 'Backlog' } });
    fireEvent.click(screen.getByRole('button', { name: /create column/i }));

    await waitFor(() =>
      expect(mockListsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Backlog',
          is_kanban: true,
        }),
      ),
    );
  });
});

