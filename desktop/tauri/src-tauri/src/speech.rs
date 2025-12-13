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

// Queue of pending authorization senders. Since all requests are asking about
// the same system-level permission, when the callback fires we complete all
// pending requests with the same result.
static AUTH_SENDERS: OnceLock<Arc<Mutex<Vec<oneshot::Sender<bool>>>>> = OnceLock::new();

// Initialize the speech recognition system
pub fn init_speech_system(app: AppHandle) {
    let _ = APP_HANDLE.set(Arc::new(Mutex::new(app)));
    let _ = AUTH_SENDERS.set(Arc::new(Mutex::new(Vec::new())));
}

// Callback for authorization - completes all pending authorization requests
// since they all ask about the same system-level permission
#[cfg(target_os = "macos")]
extern "C" fn authorization_callback(authorized: bool) {
    println!("[Speech] Authorization callback: {}", authorized);
    if let Some(senders_arc) = AUTH_SENDERS.get() {
        if let Ok(mut guard) = senders_arc.lock() {
            // Drain all pending senders and complete them with the result
            let senders: Vec<_> = guard.drain(..).collect();
            let count = senders.len();
            for sender in senders {
                let _ = sender.send(authorized);
            }
            println!("[Speech] Completed {} pending authorization request(s)", count);
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
        
        // Check if this is the first request (queue was empty)
        let should_request = if let Some(senders_arc) = AUTH_SENDERS.get() {
            if let Ok(mut guard) = senders_arc.lock() {
                let was_empty = guard.is_empty();
                guard.push(tx);
                was_empty
            } else {
                return Err("Failed to acquire lock on AUTH_SENDERS".to_string());
            }
        } else {
            return Err("Speech system not initialized".to_string());
        };
        
        // Only request authorization if we're the first request
        // (subsequent requests will wait for the same callback)
        if should_request {
            unsafe {
                speech_request_authorization(authorization_callback);
            }
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

