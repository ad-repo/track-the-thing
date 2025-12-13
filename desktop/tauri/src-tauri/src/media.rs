use nokhwa::pixel_format::RgbFormat;
use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType};
use nokhwa::Camera;
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use chrono;

// Store the ffmpeg process for video recording
static VIDEO_RECORDER: Mutex<Option<(Child, PathBuf)>> = Mutex::new(None);

/// Get or create the media directory within app data
fn get_media_dir(app: &AppHandle, subdir: &str) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let media_dir = app_data_dir.join(subdir);
    
    fs::create_dir_all(&media_dir)
        .map_err(|e| format!("Failed to create {} directory: {}", subdir, e))?;

    Ok(media_dir)
}

#[tauri::command]
pub async fn capture_photo(app: AppHandle) -> Result<String, String> {
    println!("[Media] capture_photo command called");
    
    let photos_dir = get_media_dir(&app, "photos")?;
    println!("[Media] Photos directory: {:?}", photos_dir);

    // Initialize camera
    println!("[Media] Initializing camera...");
    let index = CameraIndex::Index(0); // Use first camera
    let requested = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

    let mut camera = Camera::new(index, requested)
        .map_err(|e| {
            let err_msg = format!("Failed to initialize camera: {}", e);
            println!("[Media] Error: {}", err_msg);
            err_msg
        })?;

    // Open camera stream
    camera
        .open_stream()
        .map_err(|e| format!("Failed to open camera stream: {}", e))?;

    println!("[Media] Camera stream opened, warming up...");
    
    // Give the camera a moment to adjust (auto-exposure, etc)
    std::thread::sleep(std::time::Duration::from_millis(500));
    
    // Capture a few frames to let auto-exposure settle
    for _ in 0..5 {
        let _ = camera.frame();
    }

    // Capture frame
    println!("[Media] Capturing frame...");
    let frame = camera
        .frame()
        .map_err(|e| format!("Failed to capture frame: {}", e))?;

    // Convert to image
    let image = frame.decode_image::<RgbFormat>()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Generate filename
    let filename = format!("photo_{}.jpg", chrono::Utc::now().timestamp());
    let file_path = photos_dir.join(&filename);

    // Save image
    image
        .save(&file_path)
        .map_err(|e| format!("Failed to save image: {}", e))?;

    // Stop camera
    camera.stop_stream()
        .map_err(|e| format!("Failed to stop camera: {}", e))?;

    println!("[Media] Photo saved to: {:?}", file_path);
    
    // Return the file path for uploading to backend
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn list_cameras() -> Result<Vec<String>, String> {
    use nokhwa::query;

    let cameras = query(nokhwa::utils::ApiBackend::Auto)
        .map_err(|e| format!("Failed to query cameras: {}", e))?;

    let camera_names: Vec<String> = cameras
        .iter()
        .map(|info| info.human_name().to_string())
        .collect();

    Ok(camera_names)
}

#[tauri::command]
pub async fn start_video_recording(app: AppHandle) -> Result<String, String> {
    println!("[Media] start_video_recording command called");
    
    // Check if already recording
    {
        let guard = VIDEO_RECORDER.lock().map_err(|e| format!("Lock error: {}", e))?;
        if guard.is_some() {
            return Err("Already recording video".to_string());
        }
    }
    
    let videos_dir = get_media_dir(&app, "videos")?;
    
    // Generate filename
    let filename = format!("video_{}.webm", chrono::Utc::now().timestamp());
    let file_path = videos_dir.join(&filename);
    
    println!("[Media] Starting ffmpeg recording to: {:?}", file_path);
    
    // Spawn ffmpeg process to record from camera
    // Using avfoundation on macOS for camera + microphone capture
    let child = Command::new("ffmpeg")
        .args([
            "-f", "avfoundation",
            "-framerate", "30",
            "-video_size", "1280x720",
            "-i", "0:0",  // First video device, first audio device
            "-c:v", "libvpx-vp9",
            "-b:v", "1M",
            "-c:a", "libopus",
            "-b:a", "128k",
            "-y",  // Overwrite output file if exists
            file_path.to_str().ok_or("Invalid file path")?,
        ])
        .spawn()
        .map_err(|e| {
            let err_msg = format!("Failed to start ffmpeg: {}. Make sure ffmpeg is installed.", e);
            println!("[Media] Error: {}", err_msg);
            err_msg
        })?;
    
    println!("[Media] ffmpeg process started with PID: {}", child.id());
    
    // Store the process handle and file path
    {
        let mut guard = VIDEO_RECORDER.lock().map_err(|e| format!("Lock error: {}", e))?;
        *guard = Some((child, file_path.clone()));
    }
    
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn stop_video_recording() -> Result<String, String> {
    println!("[Media] stop_video_recording command called");
    
    let (mut child, file_path) = {
        let mut guard = VIDEO_RECORDER.lock().map_err(|e| format!("Lock error: {}", e))?;
        guard.take().ok_or("Not currently recording")?
    };
    
    // Send SIGINT (Ctrl+C) to ffmpeg to finalize the file gracefully
    #[cfg(unix)]
    {
        unsafe {
            libc::kill(child.id() as i32, libc::SIGINT);
        }
    }
    
    #[cfg(windows)]
    {
        // On Windows, we just kill the process
        let _ = child.kill();
    }
    
    // Wait for process to finish (with timeout)
    println!("[Media] Waiting for ffmpeg to finish...");
    match child.wait() {
        Ok(status) => {
            println!("[Media] ffmpeg exited with status: {}", status);
        }
        Err(e) => {
            println!("[Media] Error waiting for ffmpeg: {}", e);
        }
    }
    
    println!("[Media] Video saved to: {:?}", file_path);
    
    // Return the file path for uploading to backend
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn request_camera_permission() -> Result<bool, String> {
    // On macOS, the system will automatically prompt for permission
    // when we try to access the camera. This command can be used to
    // pre-check or trigger the permission dialog.
    println!("[Media] Camera permission requested");
    
    // Try to list cameras - this will trigger the permission dialog if needed
    match nokhwa::query(nokhwa::utils::ApiBackend::Auto) {
        Ok(_) => Ok(true),
        Err(e) => {
            println!("[Media] Camera access error: {}", e);
            Ok(false)
        }
    }
}

#[tauri::command]
pub async fn request_microphone_permission() -> Result<bool, String> {
    // On macOS, microphone permission will be requested when accessing audio
    // This is a placeholder that returns true since AVFoundation handles it
    println!("[Media] Microphone permission requested");
    Ok(true)
}

