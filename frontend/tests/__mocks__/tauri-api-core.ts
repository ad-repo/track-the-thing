/**
 * Mock for @tauri-apps/api/core
 * Used in tests to avoid Tauri desktop dependency
 */
export const invoke = async (command: string, _args?: Record<string, unknown>) => {
  console.log('[Mock] invoke called with:', command);
  
  // Return mock values based on command
  switch (command) {
    case 'request_speech_authorization':
      return true;
    case 'start_speech_recognition':
      return undefined;
    case 'stop_speech_recognition':
      return undefined;
    case 'is_speech_available':
      return true;
    case 'capture_photo':
      return '/mock/path/photo.jpg';
    case 'start_video_recording':
      return '/mock/path/video.webm';
    case 'stop_video_recording':
      return '/mock/path/video.webm';
    case 'list_cameras':
      return ['Mock Camera'];
    case 'request_camera_permission':
      return true;
    case 'request_microphone_permission':
      return true;
    default:
      return undefined;
  }
};

