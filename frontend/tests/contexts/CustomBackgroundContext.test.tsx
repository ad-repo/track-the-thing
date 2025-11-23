import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomBackgroundProvider, useCustomBackground } from '@/contexts/CustomBackgroundContext';

const mockAxiosGet = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  __esModule: true,
  default: {
    get: mockAxiosGet,
  },
}));

const Consumer = () => {
  const { enabled, toggleEnabled, currentImage, nextImage } = useCustomBackground();
  return (
    <div>
      <span data-testid="enabled">{enabled ? 'enabled' : 'disabled'}</span>
      <span data-testid="current-image">{currentImage || 'none'}</span>
      <button onClick={toggleEnabled}>toggle</button>
      <button onClick={nextImage}>next</button>
    </div>
  );
};

describe('CustomBackgroundContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAxiosGet.mockResolvedValue({
      data: [
        { id: '1', url: '/image-1.png', original_filename: 'one.png', filename: 'one.png', content_type: 'image/png', size: 100 },
        { id: '2', url: '/image-2.png', original_filename: 'two.png', filename: 'two.png', content_type: 'image/png', size: 100 },
      ],
    });
  });

  const renderProvider = () =>
    render(
      <CustomBackgroundProvider>
        <Consumer />
      </CustomBackgroundProvider>,
    );

  it('toggles background enablement and persists to localStorage', async () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');
    renderProvider();

    fireEvent.click(screen.getByText('toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('enabled')).toHaveTextContent('enabled');
      expect(setItemSpy).toHaveBeenCalledWith('custom_background_enabled', 'true');
    });
  });

  it('cycles through uploaded images when next is invoked', async () => {
    renderProvider();
    await waitFor(() => expect(mockAxiosGet).toHaveBeenCalled());

    fireEvent.click(screen.getByText('toggle')); // enable backgrounds
    fireEvent.click(screen.getByText('next'));

    expect(screen.getByTestId('current-image')).toHaveTextContent('http://localhost:8000/image-2.png');
  });
});

