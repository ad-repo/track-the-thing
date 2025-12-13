import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechRecognitionProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  continuous?: boolean;
  language?: string;
}

type RecognitionState = 'idle' | 'recording' | 'processing';

interface UseSpeechRecognitionReturn {
  isRecording: boolean;
  isSupported: boolean;
  error: string | null;
  startRecording: () => void;
  stopRecording: () => void;
  toggleRecording: () => void;
  state: RecognitionState;
}

// Extend Window interface for webkit prefix
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// Check if running in Tauri
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

/**
 * Native Tauri implementation for macOS speech recognition
 * Uses native Apple Speech framework via Rust FFI
 */
const useTauriSpeechRecognition = ({
  onTranscript,
}: UseSpeechRecognitionProps): UseSpeechRecognitionReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<RecognitionState>('idle');
  const onTranscriptRef = useRef(onTranscript);
  const unlistenRef = useRef<(() => void) | null>(null);

  // Keep callback ref up to date
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Set up event listener for speech transcription events from Rust
  useEffect(() => {
    let mounted = true;

    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const unlisten = await listen<{ text: string; isFinal: boolean }>('speech-transcription', (event) => {
          if (mounted) {
            const { text, isFinal } = event.payload;
            console.log('[TauriSpeech] Received transcription:', text, 'isFinal:', isFinal);
            onTranscriptRef.current(text, isFinal);
          }
        });
        unlistenRef.current = unlisten;
      } catch (err) {
        console.error('[TauriSpeech] Failed to set up event listener:', err);
      }
    };

    setupListener();

    return () => {
      mounted = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      console.log('[TauriSpeech] Starting recording...');
      
      const { invoke } = await import('@tauri-apps/api/core');
      
      // First request authorization
      const authorized = await invoke<boolean>('request_speech_authorization');
      console.log('[TauriSpeech] Authorization result:', authorized);
      
      if (!authorized) {
        setError('Speech recognition permission denied. Please grant permission in System Preferences > Security & Privacy > Privacy > Speech Recognition.');
        return;
      }
      
      // Start speech recognition
      await invoke('start_speech_recognition');
      setIsRecording(true);
      setState('recording');
      console.log('[TauriSpeech] Recording started successfully');
    } catch (err: any) {
      console.error('[TauriSpeech] Error starting recording:', err);
      setError(`Failed to start speech recognition: ${err.message || err}`);
      setIsRecording(false);
      setState('idle');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      console.log('[TauriSpeech] Stopping recording...');
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_speech_recognition');
      setIsRecording(false);
      setState('idle');
      console.log('[TauriSpeech] Recording stopped successfully');
    } catch (err: any) {
      console.error('[TauriSpeech] Error stopping recording:', err);
      setIsRecording(false);
      setState('idle');
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isSupported: true, // Native implementation always supported on macOS
    error,
    startRecording,
    stopRecording,
    toggleRecording,
    state,
  };
};

/**
 * Web Speech API implementation for browsers
 * Falls back to this when not running in Tauri
 */
const useWebSpeechRecognition = ({
  onTranscript,
  continuous = true,
  language = 'en-US',
}: UseSpeechRecognitionProps): UseSpeechRecognitionReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<RecognitionState>('idle');
  const recognitionRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscript);
  const shouldBeRecordingRef = useRef(false);
  const permissionRequestedRef = useRef(false);
  const retryCountRef = useRef(0);
  const isSupported = typeof window !== 'undefined' && 
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  // Keep callback ref up to date
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Request microphone permission on first interaction
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    // If already requested, don't ask again
    if (permissionRequestedRef.current) {
      return true; // Assume it was granted if we already asked
    }

    permissionRequestedRef.current = true;

    try {
      // Try to get microphone access to trigger browser permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Test if audio is actually working
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      
      // Clean up
      stream.getTracks().forEach(track => track.stop());
      audioContext.close();
      
      return true;
    } catch (err: any) {
      console.error('Microphone permission error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please click the microphone/lock icon in your browser\'s address bar, allow microphone access, then refresh the page and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone detected. Please connect a microphone and try again.');
      } else {
        setError('Failed to access microphone. Please check your browser settings.');
      }
      return false;
    }
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    // Handle results
    recognition.onresult = (event: any) => {
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }

      if (finalTranscript.trim()) {
        onTranscriptRef.current(finalTranscript, true);
      }
    };

    // Handle speech end
    recognition.onspeechend = () => {
      // Don't stop recognition here - let it continue listening for more speech
      // The onend handler will handle restarting if needed
    };

    // Handle errors
    recognition.onerror = (event: any) => {
      // Stop recording on any error
      shouldBeRecordingRef.current = false;
      setIsRecording(false);
      setState('idle');
      
      switch (event.error) {
        case 'no-speech':
          // Don't show error for no speech, just stop
          break;
        case 'audio-capture':
          setError('No microphone detected. Please check your microphone connection.');
          break;
        case 'not-allowed':
          // Permission error already shown by requestPermission, don't show again
          break;
        case 'network': {
          // Auto-retry up to 2 times with a slight delay
          if (retryCountRef.current < 2 && shouldBeRecordingRef.current) {
            retryCountRef.current++;
            setTimeout(() => {
              if (shouldBeRecordingRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (e) {
                  // Retry failed, will show error after all retries exhausted
                }
              }
            }, 500);
            return; // Don't show error yet
          }
          
          // After retries failed, show detailed error
          let networkErrorMsg = '⚠️ Chrome Speech Recognition API Failed\n\n';
          networkErrorMsg += 'This is a known bug in Chrome 130-141 where the Speech API fails immediately.\n\n';
          networkErrorMsg += 'Your microphone and internet work fine, but Chrome cannot connect to Google\'s speech service.\n\n';
          networkErrorMsg += 'Solutions:\n';
          networkErrorMsg += '• Try Safari or Microsoft Edge instead\n';
          networkErrorMsg += '• Try Chrome Canary (beta version)\n';
          networkErrorMsg += '• Wait for Chrome to fix this bug\n';
          networkErrorMsg += '• Use a different computer/Chrome profile';
          setError(networkErrorMsg);
          break;
        }
        default:
          setError(`Speech recognition error: ${event.error}`);
      }
    };

    // Handle start
    recognition.onstart = () => {
      retryCountRef.current = 0; // Reset retry count on successful start
      setIsRecording(true);
      setState('recording');
      setError(null);
    };

    // Handle end
    recognition.onend = () => {
      // If we want to keep recording and continuous mode is on, restart immediately
      if (shouldBeRecordingRef.current && continuous) {
        // Restart as quickly as possible to minimize gap
        setTimeout(() => {
          if (shouldBeRecordingRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e: any) {
              // Retry once more after a short delay
              setTimeout(() => {
                if (shouldBeRecordingRef.current && recognitionRef.current) {
                  try {
                    recognitionRef.current.start();
                  } catch (retryError) {
                    shouldBeRecordingRef.current = false;
                    setIsRecording(false);
                    setState('idle');
                  }
                }
              }, 200);
            }
          }
        }, 50);
      } else {
        // Otherwise, stop recording
        setIsRecording(false);
        setState('idle');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldBeRecordingRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [isSupported, continuous, language]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.');
      return;
    }

    // Request permission first if not already requested
    const permissionGranted = await requestPermission();
    
    // Don't proceed if permission was denied
    if (!permissionGranted) {
      return;
    }

    // Reset retry count when starting fresh
    retryCountRef.current = 0;

    if (recognitionRef.current) {
      try {
        shouldBeRecordingRef.current = true;
        recognitionRef.current.start();
      } catch (e: any) {
        if (e.message && e.message.includes('already started')) {
          // Already running, that's fine
        } else {
          setError(`Failed to start recording: ${e.message || e}`);
          shouldBeRecordingRef.current = false;
        }
      }
    }
  }, [isSupported, requestPermission]);

  const stopRecording = useCallback(() => {
    shouldBeRecordingRef.current = false;
    retryCountRef.current = 0; // Reset retry count when user stops
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Update state anyway
        setIsRecording(false);
        setState('idle');
      }
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isSupported,
    error,
    startRecording,
    stopRecording,
    toggleRecording,
    state,
  };
};

/**
 * Speech recognition hook that automatically uses native Tauri implementation
 * when running in desktop app, or Web Speech API when running in browser.
 */
export const useSpeechRecognition = (props: UseSpeechRecognitionProps): UseSpeechRecognitionReturn => {
  // Use native Tauri implementation when running in desktop app
  if (isTauri) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useTauriSpeechRecognition(props);
  }
  
  // Fall back to Web Speech API for browsers
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useWebSpeechRecognition(props);
};
