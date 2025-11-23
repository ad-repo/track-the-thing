import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Lists from '@/components/Lists';
import { renderWithRouter } from '../test-utils';
import type { List, ListWithEntries } from '@/types';

const mockListsApi = vi.hoisted(() => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/api', () => ({
  __esModule: true,
  listsApi: mockListsApi,
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

vi.mock('@/components/ListColumn', () => ({
  default: ({ list, onDelete }: { list: ListWithEntries; onDelete: (id: number, name: string) => void }) => (
    <div data-testid={`list-column-${list.id}`}>
      <span>{list.name}</span>
      <button onClick={() => onDelete(list.id, list.name)}>Delete Column</button>
    </div>
  ),
}));

const buildList = (id: number, overrides: Partial<List> = {}): List => ({
  id,
  name: `List ${String.fromCharCode(64 + id)}`,
  description: '',
  color: '#3b82f6',
  order_index: id - 1,
  is_archived: false,
  created_at: '',
  updated_at: '',
  ...overrides,
});

const withEntries = (list: List): ListWithEntries => ({
  ...list,
  entries: [],
  labels: [],
});

describe('Lists', () => {
  const listA = buildList(1);
  const listB = buildList(2);

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    mockListsApi.getAll.mockResolvedValue([listA, listB]);
    mockListsApi.getById.mockImplementation((id: number) =>
      Promise.resolve(withEntries(id === 1 ? listA : listB)),
    );
    mockListsApi.create.mockResolvedValue(buildList(3, { name: 'Created' }));
    mockListsApi.delete.mockResolvedValue(undefined);
  });

  const renderLists = () => renderWithRouter(<Lists />);

  it('loads lists from the API and renders columns in order', async () => {
    renderLists();

    await waitFor(() => {
      expect(screen.getByTestId('list-column-1')).toBeInTheDocument();
      expect(screen.getByTestId('list-column-2')).toBeInTheDocument();
    });

    expect(mockListsApi.getAll).toHaveBeenCalledTimes(1);
    expect(mockListsApi.getById).toHaveBeenCalledWith(1);
    expect(mockListsApi.getById).toHaveBeenCalledWith(2);
  });

  it('creates a new list through the modal form', async () => {
    renderLists();
    await screen.findByTestId('list-column-1');

    fireEvent.click(screen.getByTitle('Create New List'));

    const nameInput = screen.getByPlaceholderText(/in progress/i);
    fireEvent.change(nameInput, { target: { value: 'Urgent' } });

    fireEvent.click(screen.getByRole('button', { name: /create list/i }));

    await waitFor(() =>
      expect(mockListsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Urgent', description: '', color: '#3b82f6' }),
      ),
    );
    expect(mockListsApi.getAll).toHaveBeenCalledTimes(2);
  });

  it('confirms deletion and calls the delete API', async () => {
    renderLists();
    await screen.findByTestId('list-column-1');

    fireEvent.click(screen.getAllByText('Delete Column')[0]);

    await screen.findByText(/delete list\?/i);
    fireEvent.click(screen.getByRole('button', { name: /delete list/i }));

    await waitFor(() => expect(mockListsApi.delete).toHaveBeenCalledWith(1));
  });
});

