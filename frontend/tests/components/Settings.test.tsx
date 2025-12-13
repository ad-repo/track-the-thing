import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Settings from '@/components/Settings';
import { renderWithRouter } from '../test-utils';

// Create hoisted mocks for axios - both direct usage and instance created via axios.create()
const mockAxios = vi.hoisted(() => {
  const mockMethods = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  };
  return mockMethods;
});

vi.mock('axios', () => ({
  __esModule: true,
  default: {
    ...mockAxios,
    create: vi.fn(() => mockAxios),
  },
}));

const mockSetTimezone = vi.fn();
vi.mock('@/contexts/TimezoneContext', () => ({
  useTimezone: () => ({ timezone: 'UTC', setTimezone: mockSetTimezone }),
}));

const mockSetTheme = vi.fn();
const mockDeleteCustomTheme = vi.fn();
const mockRestoreTheme = vi.fn();
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    currentTheme: { id: 'default', name: 'Default' },
    availableThemes: [],
    customThemes: [],
    setTheme: mockSetTheme,
    deleteCustomTheme: mockDeleteCustomTheme,
    isBuiltInTheme: () => true,
    isThemeModified: () => false,
    restoreThemeToDefault: mockRestoreTheme,
  }),
}));

const mockUseCustomBackground = {
  enabled: false,
  toggleEnabled: vi.fn(),
  currentImage: null,
  uploadedImages: [],
  fetchUploadedImages: vi.fn(),
  nextImage: vi.fn(),
  autoRotate: false,
  toggleAutoRotate: vi.fn(),
  rotationInterval: 5,
  setRotationInterval: vi.fn(),
};

vi.mock('@/contexts/CustomBackgroundContext', () => ({
  useCustomBackground: () => mockUseCustomBackground,
}));

const mockToggleTransparentLabels = vi.fn();
vi.mock('@/contexts/TransparentLabelsContext', () => ({
  useTransparentLabels: () => ({ transparentLabels: false, toggleTransparentLabels: mockToggleTransparentLabels }),
}));

vi.mock('@/contexts/DailyGoalsContext', () => ({
  useDailyGoals: () => ({ showDailyGoals: true, setShowDailyGoals: vi.fn() }),
}));

vi.mock('@/contexts/SprintGoalsContext', () => ({
  useSprintGoals: () => ({ showSprintGoals: true, setShowSprintGoals: vi.fn() }),
}));

vi.mock('@/contexts/QuarterlyGoalsContext', () => ({
  useQuarterlyGoals: () => ({ showQuarterlyGoals: true, setShowQuarterlyGoals: vi.fn() }),
}));

vi.mock('@/contexts/DayLabelsContext', () => ({
  useDayLabels: () => ({ showDayLabels: true, setShowDayLabels: vi.fn() }),
}));

const mockSetEmojiLibrary = vi.fn();
vi.mock('@/contexts/EmojiLibraryContext', () => ({
  useEmojiLibrary: () => ({ emojiLibrary: 'emoji-picker-react', setEmojiLibrary: mockSetEmojiLibrary }),
}));

vi.mock('@/hooks/useTexture', () => ({
  useTexture: () => ({}),
}));

vi.mock('@/components/CustomThemeCreator', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('@/components/CustomBackgroundSettings', () => ({
  __esModule: true,
  default: () => <div data-testid="custom-bg-settings" />,
}));

vi.mock('@/components/CustomEmojiManager', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('@/components/TextureSettings', () => ({
  __esModule: true,
  default: () => <div data-testid="texture-settings" />,
}));

const hydrateAxios = () => {
  mockAxios.get.mockImplementation((url: string) => {
    if (url.includes('/api/settings')) {
      return Promise.resolve({
        data: { daily_goal_end_time: '17:30' },
      });
    }
    if (url.includes('/api/labels')) {
      return Promise.resolve({ data: [] });
    }
    return Promise.resolve({ data: {} });
  });
  mockAxios.patch.mockResolvedValue({ data: {} });
  mockAxios.post.mockResolvedValue({ data: {} });
  mockAxios.delete.mockResolvedValue({ data: {} });
};

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hydrateAxios();
  });

  const renderSettings = () => renderWithRouter(<Settings />);

  it('loads settings and renders the settings page', async () => {
    renderSettings();

    // Wait for the settings page to load
    await waitFor(() => {
      expect(mockAxios.get).toHaveBeenCalled();
    });

    // Check that various sections are rendered
    expect(screen.getByText('Transparent Backgrounds')).toBeInTheDocument();
    expect(screen.getByText('Daily Goals')).toBeInTheDocument();
  });

  it('toggles transparent labels when the switch is clicked', async () => {
    renderSettings();
    await screen.findByText('Transparent Backgrounds');

    const toggleContainer = screen.getByText('Transparent Backgrounds').closest('div')?.parentElement;
    const toggle = toggleContainer?.querySelector('button');
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle!);

    expect(mockToggleTransparentLabels).toHaveBeenCalled();
  });

  it('switches emoji libraries when selecting a different provider', async () => {
    renderSettings();
    await screen.findByText('Emoji Picker React');

    fireEvent.click(screen.getByRole('button', { name: /emoji mart/i }));

    expect(mockSetEmojiLibrary).toHaveBeenCalledWith('emoji-mart');
  });
});

