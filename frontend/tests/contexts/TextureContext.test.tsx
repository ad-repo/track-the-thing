import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TextureProvider, useTextures } from '@/contexts/TextureContext';

const settingsApi = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/api', () => ({
  __esModule: true,
  settingsApi,
}));

const TestToggle = () => {
  const { textureEnabled, toggleTexture } = useTextures();
  return (
    <button onClick={toggleTexture} data-testid="toggle">
      {textureEnabled ? 'enabled' : 'disabled'}
    </button>
  );
};

const PatternTester = () => {
  const { getPatternForElement, setElementPattern } = useTextures();
  return (
    <div>
      <span data-testid="pattern">{getPatternForElement('cards')}</span>
      <button onClick={() => setElementPattern('cards', 'grid')} data-testid="set-pattern">
        Set Grid
      </button>
    </div>
  );
};

describe('TextureProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    settingsApi.get.mockResolvedValue({ texture_settings: null });
    settingsApi.update.mockResolvedValue({});
  });

  const renderWithProvider = (node: React.ReactNode) => render(<TextureProvider>{node}</TextureProvider>);

  it('toggles master texture state and persists it', async () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');
    renderWithProvider(<TestToggle />);

    fireEvent.click(screen.getByTestId('toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('toggle')).toHaveTextContent('enabled');
      expect(setItemSpy).toHaveBeenCalledWith('texture_enabled', 'true');
    });
  });

  it('updates and retrieves per-element patterns', () => {
    renderWithProvider(<PatternTester />);

    expect(screen.getByTestId('pattern')).toHaveTextContent('noise');
    fireEvent.click(screen.getByTestId('set-pattern'));
    expect(screen.getByTestId('pattern')).toHaveTextContent('grid');
  });
});

