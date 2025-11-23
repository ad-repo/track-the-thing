import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CustomBackgroundSettings from '@/components/CustomBackgroundSettings';

const createImage = (id: string) => ({
  id,
  filename: `${id}.png`,
  original_filename: `${id}.png`,
  url: `/files/${id}.png`,
  content_type: 'image/png',
  size: 100,
});

const mockToggleEnabled = vi.hoisted(() => vi.fn());
const mockNextImage = vi.hoisted(() => vi.fn());
const mockToggleAutoRotate = vi.hoisted(() => vi.fn());
const mockSetRotationInterval = vi.hoisted(() => vi.fn());
const mockToggleTileMode = vi.hoisted(() => vi.fn());

const mockContextState = vi.hoisted(() => ({
  enabled: false,
  toggleEnabled: mockToggleEnabled,
  currentImage: null,
  uploadedImages: [] as ReturnType<typeof createImage>[],
  fetchUploadedImages: vi.fn(),
  nextImage: mockNextImage,
  autoRotate: false,
  toggleAutoRotate: mockToggleAutoRotate,
  rotationInterval: 60,
  setRotationInterval: mockSetRotationInterval,
  tileMode: false,
  toggleTileMode: mockToggleTileMode,
}));

vi.mock('@/contexts/CustomBackgroundContext', () => ({
  useCustomBackground: () => mockContextState,
}));

describe('CustomBackgroundSettings', () => {
  const onUpload = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    Object.assign(mockContextState, {
      enabled: false,
      uploadedImages: [],
      autoRotate: false,
      rotationInterval: 60,
      tileMode: false,
    });
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(<CustomBackgroundSettings onUpload={onUpload} onDelete={onDelete} isUploading={false} />);

  it('disables background toggle when no images are uploaded', () => {
    renderComponent();
    const enableToggle = screen.getByText('Enable Backgrounds').closest('div')?.parentElement?.querySelector('button');
    expect(enableToggle).toBeDefined();
    expect(enableToggle).toBeDisabled();
  });

  it('enables background toggle and invokes handler when images exist', () => {
    mockContextState.uploadedImages = [createImage('1')];
    renderComponent();

    const enableToggle = screen.getByText('Enable Backgrounds').closest('div')?.parentElement?.querySelector('button');
    fireEvent.click(enableToggle!);

    expect(mockToggleEnabled).toHaveBeenCalled();
  });

  it('invokes auto-rotate toggle when enabled', () => {
    Object.assign(mockContextState, {
      enabled: true,
      uploadedImages: [createImage('1')],
      autoRotate: false,
    });
    renderComponent();

    const autoRotateToggle = screen.getByText('Auto-Rotate').closest('div')?.parentElement?.querySelector('button');
    fireEvent.click(autoRotateToggle!);

    expect(mockToggleAutoRotate).toHaveBeenCalled();
  });

  it('updates rotation interval when input changes', () => {
    Object.assign(mockContextState, {
      enabled: true,
      uploadedImages: [createImage('1')],
      autoRotate: true,
    });
    renderComponent();

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '90' } });

    expect(mockSetRotationInterval).toHaveBeenCalledWith(90);
  });

  it('calls onUpload when files are selected', () => {
    renderComponent();

    const fileInput = screen.getByLabelText(/upload/i) as HTMLInputElement;
    const file = new File(['data'], 'sample.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(onUpload).toHaveBeenCalledWith(expect.objectContaining({ target: expect.any(Object) }));
  });

  it('renders delete button and calls onDelete for uploaded images', () => {
    Object.assign(mockContextState, {
      enabled: true,
      uploadedImages: [createImage('1')],
    });
    renderComponent();

    const deleteButton = screen.getByRole('button', { name: /delete image/i });
    fireEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('shows Next button when backgrounds are enabled with images', () => {
    Object.assign(mockContextState, {
      enabled: true,
      uploadedImages: [createImage('1')],
    });
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(mockNextImage).toHaveBeenCalled();
  });
});

