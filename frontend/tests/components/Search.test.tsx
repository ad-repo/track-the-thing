import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Search from '@/components/Search';
import { renderWithRouter } from '../test-utils';
import type { NoteEntry } from '@/types';

const mockAxiosGet = vi.hoisted(() => vi.fn());
const mockAxiosPost = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  __esModule: true,
  default: {
    get: mockAxiosGet,
    post: mockAxiosPost,
    delete: vi.fn(),
  },
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/contexts/TimezoneContext', () => ({
  useTimezone: () => ({ timezone: 'UTC' }),
}));

vi.mock('@/contexts/TransparentLabelsContext', () => ({
  useTransparentLabels: () => ({ transparentLabels: false }),
}));

vi.mock('@/hooks/useTexture', () => ({
  useTexture: () => ({}),
}));

vi.mock('@/utils/timezone', () => ({
  formatTimestamp: (value: string) => `formatted-${value}`,
}));

const baseLabels = [
  { id: 1, name: 'Work', color: '#3b82f6' },
];

const baseHistory = [
  { query: 'standup', created_at: '2025-11-06T10:00:00Z' },
];

const mockEntries: (NoteEntry & { date: string })[] = [
  {
    id: 1,
    date: '2025-11-07',
    daily_note_id: 1,
    title: 'Sprint Planning',
    content: '<p>Plan</p>',
    content_type: 'rich_text',
    order_index: 0,
    created_at: '2025-11-07T09:00:00Z',
    updated_at: '2025-11-07T09:00:00Z',
    labels: [],
    include_in_report: false,
    is_important: false,
    is_completed: false,
    is_pinned: false,
  },
];

const mockLists = [
  {
    id: 10,
    name: 'Deep Work',
    description: '',
    color: '#f97316',
    order_index: 0,
    is_archived: false,
    entries: [],
    created_at: '',
    updated_at: '',
    labels: [],
  },
];

let labelsResponse = [...baseLabels];
let historyResponse = [...baseHistory];
let searchResponse: { entries: typeof mockEntries; lists: typeof mockLists } = {
  entries: mockEntries,
  lists: mockLists,
};

const hydrateAxios = () => {
  mockAxiosGet.mockImplementation((url: string, config?: Record<string, any>) => {
    if (url.includes('/api/labels/')) {
      return Promise.resolve({ data: labelsResponse });
    }
    if (url.includes('/api/search-history/')) {
      return Promise.resolve({ data: historyResponse });
    }
    if (url.includes('/api/search/all')) {
      return Promise.resolve({ data: searchResponse });
    }
    return Promise.resolve({ data: [] });
  });
  mockAxiosPost.mockResolvedValue({ data: {} });
};

describe('Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    labelsResponse = [...baseLabels];
    historyResponse = [...baseHistory];
    searchResponse = { entries: mockEntries, lists: mockLists };
    hydrateAxios();
  });

  const renderSearch = () => renderWithRouter(<Search />);

  it('performs a text search when pressing Enter and renders results', async () => {
    renderSearch();

    await waitFor(() => {
      const labelsCall = mockAxiosGet.mock.calls.find(([url]) => url.includes('/api/labels/'));
      expect(labelsCall).toBeTruthy();
    });

    const input = screen.getByPlaceholderText(/search by text/i);
    fireEvent.change(input, { target: { value: 'retro' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    await screen.findByText('Sprint Planning');
    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining('/api/search/all'),
      expect.objectContaining({ params: expect.objectContaining({ q: 'retro' }) }),
    );
    expect(mockAxiosPost).toHaveBeenCalledWith(expect.stringContaining('/api/search-history/'), null, {
      params: { query: 'retro' },
    });
  });

  it('applies label filters automatically when a label chip is toggled', async () => {
    renderSearch();
    await screen.findByText('Work');

    fireEvent.click(screen.getByText('Work'));

    await waitFor(() => {
      const searchCall = mockAxiosGet.mock.calls.find(([url]) => url.includes('/api/search/all'));
      expect(searchCall?.[1]?.params?.label_ids).toBe('1');
    });
  });

  it('navigates to the selected entry when a result card is clicked', async () => {
    renderSearch();
    await screen.findByText('Work');

    const input = screen.getByPlaceholderText(/search by text/i);
    fireEvent.change(input, { target: { value: 'sprint' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    const entryCard = await screen.findByText('Sprint Planning');
    fireEvent.click(entryCard);

    expect(mockNavigate).toHaveBeenCalledWith('/day/2025-11-07#entry-1');
  });

  it('does not hit the search API until the query is submitted', async () => {
    renderSearch();
    await screen.findByText('Work');

    const input = screen.getByPlaceholderText(/search by text/i);
    fireEvent.change(input, { target: { value: 'retro' } });

    expect(mockAxiosGet.mock.calls.filter(([url]) => url.includes('/api/search/all')).length).toBe(0);

    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    await screen.findByText('Sprint Planning');
    const searchCalls = mockAxiosGet.mock.calls.filter(([url]) => url.includes('/api/search/all'));
    expect(searchCalls.length).toBe(1);
  });

  it('combines multiple label filters in the search params', async () => {
    labelsResponse = [
      ...baseLabels,
      { id: 2, name: 'Personal', color: '#16a34a' },
    ];
    renderSearch();
    await screen.findByText('Work');

    fireEvent.click(screen.getByText('Work'));
    fireEvent.click(screen.getByText('Personal'));

    await waitFor(() => {
      const searchCalls = mockAxiosGet.mock.calls.filter(([url]) => url.includes('/api/search/all'));
      expect(searchCalls.some(([, config]) => config?.params?.label_ids === '1,2')).toBe(true);
    });
  });

  it('saves searches to history and shows the updated history list', async () => {
    mockAxiosPost.mockImplementation(() => {
      historyResponse = [
        ...historyResponse,
        { query: 'retro', created_at: '2025-11-07T11:00:00Z' },
      ];
      return Promise.resolve({ data: {} });
    });

    renderSearch();
    const input = await screen.findByPlaceholderText(/search by text/i);
    fireEvent.change(input, { target: { value: 'retro' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    await screen.findByText('Sprint Planning');
    await screen.findByText('retro');
  });
});

