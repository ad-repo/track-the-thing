import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

const TestComponent = ({ onTranscript = vi.fn() }: { onTranscript?: (text: string, isFinal: boolean) => void }) => {
  const { isRecording, startRecording, stopRecording, isSupported, error, state, toggleRecording } = useSpeechRecognition({
    onTranscript,
  });

  return (
    <div>
      <span data-testid="supported">{isSupported ? 'supported' : 'unsupported'}</span>
      <span data-testid="status">{isRecording ? 'recording' : 'idle'}</span>
      <span data-testid="state">{state}</span>
      <span data-testid="error">{error || 'no-error'}</span>
      <button onClick={startRecording}>start</button>
      <button onClick={stopRecording}>stop</button>
      <button onClick={toggleRecording}>toggle</button>
    </div>
  );
};

class MockRecognition {
  public onresult?: (...args: any[]) => void;
  public onstart?: () => void;
  public onend?: () => void;
  public onerror?: (event: any) => void;
  continuous = true;
  interimResults = true;
  lang = 'en-US';
  maxAlternatives = 1;

  start = vi.fn(() => {
    this.onstart?.();
  });

  stop = vi.fn(() => {
    this.onend?.();
  });

  abort = vi.fn();
}

describe('useSpeechRecognition', () => {
  const originalSpeechRecognition = window.SpeechRecognition;
  const originalWebkitSpeechRecognition = window.webkitSpeechRecognition;
  const originalAudioContext = window.AudioContext;
  let getUserMediaSpy: ReturnType<typeof vi.spyOn> | undefined;
  let recognitionInstance: MockRecognition;

  beforeEach(() => {
    recognitionInstance = new MockRecognition();
    window.SpeechRecognition = vi.fn(() => recognitionInstance) as any;
    window.webkitSpeechRecognition = undefined as any;

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {} as MediaDevices,
      });
    }
    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = vi.fn();
    }
    getUserMediaSpy = vi
      .spyOn(navigator.mediaDevices, 'getUserMedia')
      .mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      } as any);

    window.AudioContext = class {
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return { connect: vi.fn() };
      }
      close() {
        return Promise.resolve();
      }
    } as any;
  });

  afterEach(() => {
    window.SpeechRecognition = originalSpeechRecognition;
    window.webkitSpeechRecognition = originalWebkitSpeechRecognition;
    getUserMediaSpy?.mockRestore();
    window.AudioContext = originalAudioContext;
  });

  const renderHook = () => render(<TestComponent />);

  it('starts and stops recording via the exposed controls', async () => {
    renderHook();

    fireEvent.click(screen.getByText('start'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('recording'));

    fireEvent.click(screen.getByText('stop'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('idle'));
  });

  it('reports unsupported state when recognition APIs are missing', () => {
    window.SpeechRecognition = undefined as any;
    renderHook();

    expect(screen.getByTestId('supported')).toHaveTextContent('unsupported');
  });

  it('toggles recording state when toggleRecording is called', async () => {
    renderHook();

    // Start recording via toggle
    fireEvent.click(screen.getByText('toggle'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('recording'));

    // Stop recording via toggle
    fireEvent.click(screen.getByText('toggle'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('idle'));
  });

  it('reports idle state initially', () => {
    renderHook();
    expect(screen.getByTestId('state')).toHaveTextContent('idle');
  });

  it('reports recording state after starting', async () => {
    renderHook();
    
    fireEvent.click(screen.getByText('start'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('recording'));
  });

  it('reports no error initially', () => {
    renderHook();
    expect(screen.getByTestId('error')).toHaveTextContent('no-error');
  });

  it('starts recognition when start is clicked', async () => {
    render(<TestComponent />);

    fireEvent.click(screen.getByText('start'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('recording'));

    // Recognition instance start should have been called
    expect(recognitionInstance.start).toHaveBeenCalled();
  });

  it('supports webkit prefixed speech recognition', () => {
    window.SpeechRecognition = undefined as any;
    window.webkitSpeechRecognition = vi.fn(() => recognitionInstance) as any;
    
    renderHook();
    expect(screen.getByTestId('supported')).toHaveTextContent('supported');
  });
});

