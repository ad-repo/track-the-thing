import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

const TestComponent = () => {
  const { isRecording, startRecording, stopRecording, isSupported } = useSpeechRecognition({
    onTranscript: vi.fn(),
  });

  return (
    <div>
      <span data-testid="supported">{isSupported ? 'supported' : 'unsupported'}</span>
      <span data-testid="status">{isRecording ? 'recording' : 'idle'}</span>
      <button onClick={startRecording}>start</button>
      <button onClick={stopRecording}>stop</button>
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
});

