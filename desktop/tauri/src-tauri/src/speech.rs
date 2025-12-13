use std::ffi::CStr;
use std::os::raw::c_char;
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;

// FFI declarations for Objective-C functions
#[cfg(target_os = "macos")]
extern "C" {
    fn speech_request_authorization(callback: extern "C" fn(bool));
    fn speech_start_recording(callback: extern "C" fn(*const c_char, bool)) -> bool;
    fn speech_stop_recording();
    fn speech_is_available() -> bool;
}

// Global state to hold the app handle for callbacks (using OnceLock for thread safety)
static APP_HANDLE: OnceLock<Arc<Mutex<AppHandle>>> = OnceLock::new();

// Global state for authorization callback
static AUTH_SENDER: OnceLock<Arc<Mutex<Option<oneshot::Sender<bool>>>>> = OnceLock::new();

// Initialize the speech recognition system
pub fn init_speech_system(app: AppHandle) {
    let _ = APP_HANDLE.set(Arc::new(Mutex::new(app)));
    let _ = AUTH_SENDER.set(Arc::new(Mutex::new(None)));
}

// Callback for authorization
#[cfg(target_os = "macos")]
extern "C" fn authorization_callback(authorized: bool) {
    println!("[Speech] Authorization callback: {}", authorized);
    if let Some(sender_arc) = AUTH_SENDER.get() {
        if let Ok(mut guard) = sender_arc.lock() {
            if let Some(sender) = guard.take() {
                let _ = sender.send(authorized);
            }
        }
    }
}

// Callback for transcription results
#[cfg(target_os = "macos")]
extern "C" fn transcription_callback(text_ptr: *const c_char, is_final: bool) {
    unsafe {
        println!("[Speech] transcription_callback called, is_final: {}", is_final);
        
        if text_ptr.is_null() {
            println!("[Speech] Error: text_ptr is null");
            return;
        }
        
        let c_str = CStr::from_ptr(text_ptr);
        if let Ok(text) = c_str.to_str() {
            println!("[Speech] Transcription text: '{}', is_final: {}", text, is_final);
            
            // Emit event to frontend
            if let Some(app_handle_arc) = APP_HANDLE.get() {
                if let Ok(guard) = app_handle_arc.lock() {
                    println!("[Speech] Emitting speech-transcription event...");
                    match guard.emit("speech-transcription", serde_json::json!({
                        "text": text,
                        "isFinal": is_final
                    })) {
                        Ok(_) => println!("[Speech] Event emitted successfully"),
                        Err(e) => println!("[Speech] Failed to emit event: {:?}", e),
                    }
                } else {
                    println!("[Speech] Error: Failed to lock APP_HANDLE");
                }
            } else {
                println!("[Speech] Error: APP_HANDLE not initialized");
            }
        } else {
            println!("[Speech] Error: Failed to convert C string to Rust string");
        }
    }
}

#[tauri::command]
pub async fn request_speech_authorization() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        println!("[Speech] Requesting authorization...");
        
        // Create a oneshot channel for the callback
        let (tx, rx) = oneshot::channel();
        
        // Store the sender in the global state
        if let Some(sender_arc) = AUTH_SENDER.get() {
            if let Ok(mut guard) = sender_arc.lock() {
                *guard = Some(tx);
            } else {
                return Err("Failed to acquire lock on AUTH_SENDER".to_string());
            }
        } else {
            return Err("Speech system not initialized".to_string());
        }
        
        // Request authorization
        unsafe {
            speech_request_authorization(authorization_callback);
        }
        
        // Wait for the callback with a timeout
        match tokio::time::timeout(std::time::Duration::from_secs(30), rx).await {
            Ok(Ok(authorized)) => {
                println!("[Speech] Authorization result: {}", authorized);
                Ok(authorized)
            }
            Ok(Err(_)) => {
                Err("Authorization callback failed".to_string())
            }
            Err(_) => {
                Err("Authorization request timed out".to_string())
            }
        }
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err("Speech recognition is only available on macOS".to_string())
    }
}

#[tauri::command]
pub async fn start_speech_recognition() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        println!("[Speech] start_speech_recognition command called");
        unsafe {
            let success = speech_start_recording(transcription_callback);
            println!("[Speech] speech_start_recording returned: {}", success);
            if success {
                println!("[Speech] Speech recognition started successfully");
                Ok(())
            } else {
                let err_msg = "Failed to start speech recognition".to_string();
                println!("[Speech] Error: {}", err_msg);
                Err(err_msg)
            }
        }
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err("Speech recognition is only available on macOS".to_string())
    }
}

#[tauri::command]
pub async fn stop_speech_recognition() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        println!("[Speech] stop_speech_recognition command called");
        unsafe {
            speech_stop_recording();
        }
        println!("[Speech] Speech recognition stopped");
        Ok(())
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err("Speech recognition is only available on macOS".to_string())
    }
}

#[tauri::command]
pub async fn is_speech_available() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        unsafe {
            Ok(speech_is_available())
        }
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Ok(false)
    }
}

