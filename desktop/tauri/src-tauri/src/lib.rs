use std::{
  env,
  fs,
  path::{Path, PathBuf},
  process::{Child, Command},
  sync::Mutex,
  time::{Duration, Instant},
};

use dotenvy::from_path;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use shell_words;
use tauri::{async_runtime, path::BaseDirectory, Manager, WindowEvent};
use tokio::time::sleep;

#[derive(Default)]
struct BackendProcess {
  child: Mutex<Option<Child>>,
}

impl BackendProcess {
  fn replace(&self, child: Child) {
    *self.child.lock().expect("backend lock poisoned") = Some(child);
  }

  fn terminate(&self) {
    if let Some(mut child) = self.child.lock().expect("backend lock poisoned").take() {
      if let Err(err) = child.kill() {
        warn!("Failed to stop backend sidecar: {err}");
      }
    }
  }
}

#[derive(Serialize, Deserialize, Debug)]
struct WindowPreferences {
  width: u32,
  height: u32,
  maximized: bool,
}

impl WindowPreferences {
  fn load(app: &tauri::AppHandle) -> Option<Self> {
    let config_path = app
      .path()
      .app_config_dir()
      .ok()?
      .join("window_prefs.json");
    
    if !config_path.exists() {
      info!("No window preferences file found at {:?}", config_path);
      return None;
    }
    
    match fs::read_to_string(&config_path) {
      Ok(content) => match serde_json::from_str::<WindowPreferences>(&content) {
        Ok(prefs) => {
          info!("Loaded window preferences: {}x{}, maximized: {}", prefs.width, prefs.height, prefs.maximized);
          Some(prefs)
        }
        Err(e) => {
          warn!("Failed to parse window preferences: {}", e);
          None
        }
      },
      Err(e) => {
        warn!("Failed to read window preferences: {}", e);
        None
      }
    }
  }
  
  fn save(&self, app: &tauri::AppHandle) {
    if let Ok(config_dir) = app.path().app_config_dir() {
      // Create config directory if it doesn't exist
      if let Err(e) = fs::create_dir_all(&config_dir) {
        warn!("Failed to create config directory: {}", e);
        return;
      }
      
      let config_path = config_dir.join("window_prefs.json");
      
      match serde_json::to_string_pretty(self) {
        Ok(json) => {
          if let Err(e) = fs::write(&config_path, json) {
            warn!("Failed to write window preferences: {}", e);
          } else {
            info!("Saved window preferences: {}x{}, maximized: {}", self.width, self.height, self.maximized);
          }
        }
        Err(e) => {
          warn!("Failed to serialize window preferences: {}", e);
        }
      }
    }
  }
}

#[derive(Clone)]
struct DesktopConfig {
  repo_root: PathBuf,
  platform_dir: &'static str,
  binary_name: &'static str,
  health_url: String,
  window_height_ratio: f64,
  window_width: Option<f64>,
  window_maximized: bool,
  splash_min: Duration,
  launcher_command: String,
}

impl DesktopConfig {
  fn from_env(repo_root: PathBuf) -> Self {
    #[cfg(target_os = "windows")]
    let platform = ("windows", "track-the-thing-backend.exe");
    #[cfg(target_os = "macos")]
    let platform = ("macos", "track-the-thing-backend");
    #[cfg(target_os = "linux")]
    let platform = ("linux", "track-the-thing-backend");

    let backend_host = env::var("TAURI_BACKEND_HOST").unwrap_or_else(|_| "127.0.0.1".into());
    let backend_port = env::var("TAURI_BACKEND_PORT")
      .ok()
      .and_then(|value| value.parse::<u16>().ok())
      .unwrap_or(18765);
    let health_url = format!("http://{backend_host}:{backend_port}/health");

    let window_height_ratio = env::var("TAURI_WINDOW_HEIGHT_RATIO")
      .ok()
      .and_then(|value| value.parse::<f64>().ok())
      .map(|ratio| ratio.clamp(0.5, 0.98))
      .unwrap_or(0.95);

    let window_width = env::var("TAURI_WINDOW_WIDTH")
      .ok()
      .and_then(|value| value.parse::<f64>().ok())
      .filter(|width| *width > 320.0);

    let window_maximized = env::var("TAURI_WINDOW_MAXIMIZED")
      .map(|value| matches!(value.to_ascii_lowercase().as_str(), "1" | "true" | "yes"))
      .unwrap_or(false);

    let splash_min = env::var("TAURI_SPLASH_MIN_VISIBLE_MS")
      .ok()
      .and_then(|value| value.parse::<u64>().ok())
      .map(Duration::from_millis)
      .unwrap_or(Duration::from_millis(1200));

    let launcher_command =
      env::var("PYINSTALLER_ENTRYPOINT").unwrap_or_else(|_| "python3 backend/desktop_launcher.py".into());

    Self {
      repo_root,
      platform_dir: platform.0,
      binary_name: platform.1,
      health_url,
      window_height_ratio,
      window_width,
      window_maximized,
      splash_min,
      launcher_command,
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(BackendProcess::default())
    .setup(|app| {
      // Enable logging in both debug and release modes
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .build(),
      )?;
      
      // Enable opening external URLs in system browser
      app.handle().plugin(tauri_plugin_opener::init())?;

      let repo_root = resolve_repo_root();
      
      // In production (release build), skip loading .tourienv from compile-time source directory
      // and use platform-appropriate production defaults instead
      if cfg!(debug_assertions) {
        info!("Running in debug mode - loading .tourienv from source directory");
        load_touri_env(&repo_root);
      } else {
        info!("Running in production mode - using platform defaults (ignoring .tourienv from source)");
        load_production_env();
      }
      
      let config = DesktopConfig::from_env(repo_root.clone());
      initialize_windows(app, &config);

      let child = spawn_backend(&app.handle(), &config)?;
      app.state::<BackendProcess>().replace(child);

      wait_for_backend_ready(app.handle().clone(), config);
      Ok(())
    })
    .on_window_event(|window, event| {
      if window.label() == "main" {
        match event {
          WindowEvent::CloseRequested { .. } => {
            // Save window size before closing
            if let Ok(size) = window.outer_size() {
              if let Ok(is_maximized) = window.is_maximized() {
                let prefs = WindowPreferences {
                  width: size.width,
                  height: size.height,
                  maximized: is_maximized,
                };
                prefs.save(&window.app_handle());
              }
            }
            window.app_handle().state::<BackendProcess>().terminate();
          }
          WindowEvent::Resized(size) => {
            // Save window size when resized (debounced by only saving on meaningful changes)
            if size.width >= 480 && size.height >= 600 {
              if let Ok(is_maximized) = window.is_maximized() {
                let prefs = WindowPreferences {
                  width: size.width,
                  height: size.height,
                  maximized: is_maximized,
                };
                prefs.save(&window.app_handle());
              }
            }
          }
          _ => {}
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn resolve_repo_root() -> PathBuf {
  let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  let repo_root = manifest_dir
    .parent()
    .and_then(Path::parent)
    .and_then(Path::parent)
    .map(Path::to_path_buf)
    .unwrap_or_else(|| {
      warn!("Unable to resolve repository root from CARGO_MANIFEST_DIR, using manifest dir");
      manifest_dir.clone()
    });
  info!("Resolved repo root: {} (from CARGO_MANIFEST_DIR: {})", repo_root.display(), manifest_dir.display());
  repo_root
}

fn load_production_env() {
  info!("Setting platform-appropriate production environment variables");
  
  #[cfg(target_os = "macos")]
  let data_dir = dirs::home_dir()
    .map(|h| h.join("Library/Application Support/TrackTheThingDesktop"))
    .expect("FATAL: Cannot resolve home directory. Unable to determine data directory location.");
  
  #[cfg(target_os = "linux")]
  let data_dir = dirs::home_dir()
    .map(|h| h.join(".local/share/track-the-thing-desktop"))
    .expect("FATAL: Cannot resolve home directory. Unable to determine data directory location.");
  
  #[cfg(target_os = "windows")]
  let data_dir = dirs::data_local_dir()
    .map(|d| d.join("TrackTheThingDesktop"))
    .expect("FATAL: Cannot resolve local app data directory. Unable to determine data directory location.");

  // Create the data directory if it doesn't exist
  if let Err(e) = std::fs::create_dir_all(&data_dir) {
    warn!("Failed to create data directory: {}", e);
  }
  
  let data_dir_str = data_dir.to_string_lossy().to_string();
  env::set_var("TAURI_BACKEND_HOST", "127.0.0.1");
  env::set_var("TAURI_BACKEND_PORT", "18765");
  env::set_var("TAURI_DESKTOP_DATA_DIR", &data_dir_str);
  env::set_var("TAURI_DATABASE_PATH", format!("{}/ttt_desktop.db", data_dir_str));
  env::set_var("TAURI_UPLOADS_DIR", format!("{}/uploads", data_dir_str));
  env::set_var("TAURI_STATIC_DIR", format!("{}/static", data_dir_str));
  env::set_var("TAURI_BACKEND_LOG", format!("{}/logs/backend.log", data_dir_str));
  env::set_var("TAURI_WINDOW_HEIGHT_RATIO", "0.70");
  env::set_var("TAURI_WINDOW_MAXIMIZED", "false");
  
  info!("Set TAURI_DESKTOP_DATA_DIR={}", data_dir_str);
}

fn load_touri_env(repo_root: &Path) {
  let env_path = repo_root.join(".tourienv");
  if env_path.exists() {
    if let Err(err) = from_path(&env_path) {
      warn!("Failed to load .tourienv: {err}");
      load_production_env();
    } else {
      info!("Loaded desktop environment overrides from {}", env_path.display());
    }
  } else {
    warn!(".tourienv not found at {}", env_path.display());
    load_production_env();
  }
}

fn initialize_windows(app: &tauri::App, config: &DesktopConfig) {
  if let Some(main_window) = app.get_webview_window("main") {
    let _ = main_window.hide();
    
    // Try to load saved window preferences
    let saved_prefs = WindowPreferences::load(&app.handle());
    
    // Ensure window is not maximized/fullscreen from previous state
    if let Ok(is_maximized) = main_window.is_maximized() {
      if is_maximized {
        info!("Window was maximized, unmaximizing...");
        let _ = main_window.unmaximize();
      }
    }
    if let Ok(is_fullscreen) = main_window.is_fullscreen() {
      if is_fullscreen {
        info!("Window was fullscreen, exiting fullscreen...");
        let _ = main_window.set_fullscreen(false);
      }
    }
    
    if let Ok(Some(monitor)) = main_window.current_monitor() {
      let screen_size = monitor.size();
      info!("Screen size: {}x{}", screen_size.width, screen_size.height);
      
      // Use saved preferences if available, otherwise calculate from config
      let (width, height) = if let Some(prefs) = saved_prefs {
        info!("Using saved window size: {}x{}", prefs.width, prefs.height);
        (
          (prefs.width as f64).clamp(480.0, screen_size.width as f64),
          (prefs.height as f64).clamp(600.0, screen_size.height as f64),
        )
      } else {
        info!("No saved preferences, using config - height_ratio: {}, width: {:?}, maximized: {}", 
              config.window_height_ratio, config.window_width, config.window_maximized);
        // Use config width if set, otherwise default to 51% of screen + 510px
        let mut width = config
          .window_width
          .unwrap_or_else(|| (screen_size.width as f64 * 0.51) + 510.0)
          .min(screen_size.width as f64);
        if width < 480.0 {
          width = 480.0;
        }
        let height = (screen_size.height as f64 * config.window_height_ratio).min(screen_size.height as f64);
        (width, height)
      };
      
      let logical_size = tauri::LogicalSize { width, height };
      
      info!("Setting window size to {}x{}", width, height);
      let _ = main_window.set_size(logical_size);
      let _ = main_window.center();
    }
  }
}

fn spawn_backend(app: &tauri::AppHandle, config: &DesktopConfig) -> Result<Child, std::io::Error> {
  if let Some(binary_path) = packaged_backend_path(app, config) {
    info!("Checking for packaged backend at: {}", binary_path.display());
    if binary_path.exists() {
      info!("Starting packaged backend at {}", binary_path.display());
      info!("Environment variables being passed:");
      for (key, value) in env::vars() {
        if key.starts_with("TAURI_") {
          info!("  {}={}", key, value);
        }
      }
      
      match Command::new(&binary_path)
        .envs(env::vars())
        .spawn() {
        Ok(child) => {
          info!("Backend process spawned successfully with PID: {}", child.id());
          return Ok(child);
        }
        Err(e) => {
          warn!("Failed to spawn packaged backend: {}", e);
          return Err(e);
        }
      }
    } else {
      warn!("Packaged backend not found at: {}", binary_path.display());
    }
  } else {
    warn!("Could not resolve packaged backend path");
  }

  let fallback = shell_words::split(&config.launcher_command)
    .unwrap_or_else(|_| vec!["python3".into(), "backend/desktop_launcher.py".into()]);
  let (program, args) = fallback
    .split_first()
    .map(|(head, tail)| (head.clone(), tail.to_vec()))
    .unwrap_or_else(|| ("python3".into(), vec!["backend/desktop_launcher.py".into()]));

  info!("Launching backend via fallback command: {} {:?}", program, args);
  Command::new(&program)
    .args(args)
    .current_dir(&config.repo_root)
    .envs(env::vars())
    .spawn()
}

fn wait_for_backend_ready(app_handle: tauri::AppHandle, config: DesktopConfig) {
  async_runtime::spawn(async move {
    let splash = app_handle.get_webview_window("splashscreen");
    let main = app_handle.get_webview_window("main");
    let start = Instant::now();
    loop {
      if backend_is_ready(&config.health_url) {
        break;
      }
      sleep(Duration::from_millis(250)).await;
    }

    let elapsed = start.elapsed();
    if config.splash_min > elapsed {
      sleep(config.splash_min - elapsed).await;
    }

    if let Some(window) = main {
      if config.window_maximized {
        info!("Maximizing window (window_maximized={})", config.window_maximized);
        let _ = window.maximize();
      } else {
        info!("Not maximizing window (window_maximized={})", config.window_maximized);
        
        // Force unmaximize before showing
        let _ = window.unmaximize();
        let _ = window.set_fullscreen(false);
        
        // Reapply size constraints after backend is ready
        if let Ok(Some(monitor)) = window.current_monitor() {
          let screen_size = monitor.size();
          info!("Monitor screen size: {}x{}", screen_size.width, screen_size.height);
          
          // Use config width if set, otherwise default to 51% of screen + 510px
          let width = config.window_width
            .unwrap_or_else(|| (screen_size.width as f64 * 0.51) + 510.0)
            .max(480.0);
          // Height: 85% of screen + 150px (unchanged from original)
          let height = (screen_size.height as f64 * 0.85) + 150.0;
          
          let physical_size = tauri::PhysicalSize { width: width as u32, height: height as u32 };
          info!("Re-applying physical window size before show: {}x{}", width, height);
          let _ = window.set_size(physical_size);
          let _ = window.center();
        }
      }
      let _ = window.show();
      let _ = window.set_focus();
    }
    if let Some(window) = splash {
      let _ = window.close();
    }
    info!("Backend ready. Main window displayed.");
  });
}

fn backend_is_ready(url: &str) -> bool {
  ureq::get(url)
    .timeout(Duration::from_millis(500))
    .call()
    .map(|response| response.status() == 200)
    .unwrap_or(false)
}

fn packaged_backend_path(app: &tauri::AppHandle, config: &DesktopConfig) -> Option<PathBuf> {
  let relative = PathBuf::from("bin")
    .join(config.platform_dir)
    .join("track-the-thing-backend")
    .join(config.binary_name);
  app
    .path()
    .resolve(relative, BaseDirectory::Resource)
    .ok()
}
