import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TextureSettings from '@/components/TextureSettings';

const toggleTexture = vi.fn();
const setRandomEnabled = vi.fn();
const exportConfiguration = vi.fn(() => JSON.stringify({}));
const setRandomInterval = vi.fn();
const nextRandomPattern = vi.fn();
const updateGlobalSettings = vi.fn();
const setElementPattern = vi.fn();
const setGlobalPattern = vi.fn();
const importConfiguration = vi.fn();
const resetToDefaults = vi.fn();

const baseGlobalSettings = {
  scale: 1,
  opacity: 0.8,
  density: 0.5,
  angle: 0,
  blendMode: 'normal',
};

vi.mock('@/contexts/TextureContext', () => ({
  useTextures: () => ({
    textureEnabled: true,
    toggleTexture,
    globalPattern: 'dots',
    setGlobalPattern,
    globalSettings: baseGlobalSettings,
    updateGlobalSettings,
    elementPatterns: {},
    setElementPattern,
    randomEnabled: false,
    setRandomEnabled,
    randomInterval: 5,
    setRandomInterval,
    nextRandomPattern,
    resetToDefaults,
    exportConfiguration,
    importConfiguration,
  }),
}));

vi.mock('@/services/textureGenerator', () => ({
  getAllPatterns: () => ['dots', 'grid'],
  generateTexture: () => 'data:image/png;base64,preview',
  getPatternDisplayName: (pattern: string) => pattern,
}));

vi.mock('@/components/TexturePatternPreview', () => ({
  TexturePatternGrid: ({ onSelect }: { onSelect: (pattern: string) => void }) => (
    <button onClick={() => onSelect('grid')} data-testid="pattern-grid">
      Select Grid
    </button>
  ),
}));

describe('TextureSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSettings = () => render(<TextureSettings />);

  it('toggles texture support via the master switch', () => {
    renderSettings();
    const toggle = screen.getByText('Enable UI Textures').parentElement?.parentElement?.querySelector('button');
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle!);
    expect(toggleTexture).toHaveBeenCalled();
  });

  it('exports the current configuration from advanced options', () => {
    renderSettings();

    fireEvent.click(screen.getByText(/advanced options/i));
    fireEvent.click(screen.getByRole('button', { name: /export config/i }));

    expect(exportConfiguration).toHaveBeenCalled();
  });

  it('enables random rotation and advances to the next pattern', () => {
    renderSettings();

    fireEvent.click(screen.getByText(/random pattern rotation/i));
    const randomToggle = screen.getByText(/enable auto-rotation/i).parentElement?.querySelector('button');
    expect(randomToggle).toBeTruthy();
    fireEvent.click(randomToggle!);
    expect(setRandomEnabled).toHaveBeenCalledWith(true);
  });
});

