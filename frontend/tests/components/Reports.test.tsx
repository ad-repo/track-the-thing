import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import Reports from '@/components/Reports';
import { renderWithRouter } from '../test-utils';

const mockAxiosGet = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  __esModule: true,
  default: {
    get: mockAxiosGet,
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

const weeksResponse = {
  weeks: [
    { start: '2025-11-04', end: '2025-11-10', label: 'Nov 4 - Nov 10' },
    { start: '2025-10-28', end: '2025-11-03', label: 'Oct 28 - Nov 3' },
  ],
};

const reportResponse = {
  week_start: '2025-11-04',
  week_end: '2025-11-10',
  generated_at: '2025-11-10T10:00:00Z',
  entries: [
    {
      entry_id: 1,
      date: '2025-11-05',
      content: '<p>Done</p>',
      content_type: 'rich_text',
      labels: [],
      created_at: '2025-11-05T09:00:00Z',
      is_completed: true,
    },
    {
      entry_id: 2,
      date: '2025-11-06',
      content: '<p>In progress</p>',
      content_type: 'rich_text',
      labels: [],
      created_at: '2025-11-06T09:00:00Z',
      is_completed: false,
    },
  ],
};

const allEntriesResponse = {
  generated_at: '2025-11-10T10:00:00Z',
  entries: [
    {
      entry_id: 3,
      date: '2025-11-01',
      content: '<p>Global</p>',
      content_type: 'rich_text',
      labels: [],
      created_at: '2025-11-01T10:00:00Z',
      is_completed: false,
    },
  ],
};

const hydrateAxios = () => {
  mockAxiosGet.mockImplementation((url: string) => {
    if (url.includes('/api/reports/weeks')) {
      return Promise.resolve({ data: weeksResponse });
    }
    if (url.includes('/api/reports/generate')) {
      return Promise.resolve({ data: reportResponse });
    }
    if (url.includes('/api/reports/all-entries')) {
      return Promise.resolve({ data: allEntriesResponse });
    }
    return Promise.resolve({ data: {} });
  });
};

let anchorClickSpy: ReturnType<(typeof vi)['spyOn']>;

beforeAll(() => {
  anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterAll(() => {
  anchorClickSpy.mockRestore();
});

describe('Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hydrateAxios();
    window.alert = vi.fn();
    (navigator as any).clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    window.URL.createObjectURL = vi.fn(() => 'blob:mock');
    window.URL.revokeObjectURL = vi.fn();
  });

  const renderReports = () => renderWithRouter(<Reports />);
  const getGenerateButtons = () => screen.getAllByRole('button', { name: /^generate$/i });

  it('loads weeks and generates a report when a past week is chosen', async () => {
    renderReports();

    await waitFor(() => expect(mockAxiosGet).toHaveBeenCalledWith(expect.stringContaining('/api/reports/weeks')));

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '2025-11-04' } });

    await waitFor(() =>
      expect(mockAxiosGet).toHaveBeenCalledWith(expect.stringContaining('/api/reports/generate?date=2025-11-04')),
    );
    expect(screen.getByText(/report: 2025-11-04 to 2025-11-10/i)).toBeInTheDocument();
  });

  it('copies the completed section to the clipboard', async () => {
    renderReports();
    await screen.findByRole('combobox');

    fireEvent.click(getGenerateButtons()[0]);
    await screen.findByText(/report: 2025-11-04 to 2025-11-10/i);

    fireEvent.click(screen.getByTitle('Copy completed section'));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  it('exports the all-entries report to Markdown', async () => {
    renderReports();
    await screen.findByRole('combobox');

    fireEvent.click(getGenerateButtons()[1]);
    await screen.findByText(/all entries/i);

    fireEvent.click(screen.getByRole('button', { name: /export to markdown/i }));

    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });
});

