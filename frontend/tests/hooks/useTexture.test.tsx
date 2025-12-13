import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTexture } from '@/hooks/useTexture';

const mockGenerateTexture = vi.hoisted(() => vi.fn(() => 'data:texture'));
const mockUseTextures = vi.hoisted(() =>
  vi.fn(() => ({
    textureEnabled: true,
    globalSettings: { colorTint: '#123456' },
    elementPatterns: { cards: 'grid' },
    elementSettings: { cards: null },
  })),
);

vi.mock('@/services/textureGenerator', () => ({
  __esModule: true,
  generateTexture: mockGenerateTexture,
}));

vi.mock('@/contexts/TextureContext', () => ({
  useTextures: mockUseTextures,
}));

const TestComponent = () => {
  const styles = useTexture('cards');
  return (
    <div data-testid="styled" style={styles}>
      test
    </div>
  );
};

describe('useTexture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTextures.mockReset();
    mockUseTextures.mockReturnValue({
      textureEnabled: true,
      globalSettings: { colorTint: '#123456' },
      elementPatterns: { cards: 'grid' },
      elementSettings: { cards: null },
    } as any);
  });

  it('returns texture styles when enabled with element pattern', () => {
    render(<TestComponent />);

    const styled = screen.getByTestId('styled');
    expect(mockGenerateTexture).toHaveBeenCalledWith('grid', { colorTint: '#123456' });
    expect(styled.style.backgroundImage).toContain('linear-gradient(#123456');
    expect(styled.style.backgroundRepeat).toBe('repeat');
  });

  it('returns empty styles when textures are disabled', () => {
    mockUseTextures.mockReturnValue({
      textureEnabled: false,
      globalSettings: {},
      elementPatterns: { cards: 'grid' },
      elementSettings: { cards: null },
    } as any);

    render(<TestComponent />);

    expect(screen.getByTestId('styled').style.backgroundImage).toBe('');
    expect(mockGenerateTexture).not.toHaveBeenCalled();
  });

  it('memoizes styles per inputs', () => {
    render(<TestComponent />);
    const firstCall = mockGenerateTexture.mock.calls.length;

    render(<TestComponent />);
    const secondCall = mockGenerateTexture.mock.calls.length;

    expect(secondCall).toBe(firstCall + 1);
  });
});


