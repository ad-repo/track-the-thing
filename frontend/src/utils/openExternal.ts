/**
 * Opens an external URL in the system's default browser.
 * Uses Tauri's opener plugin when running in desktop app,
 * falls back to window.open for web browser.
 */
export async function openExternal(url: string): Promise<void> {
  // Check if running in Tauri
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    try {
      // Dynamic import - only loaded when running in Tauri
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    } catch (error) {
      console.error('Failed to open URL via Tauri:', error);
      // Fallback to window.open if Tauri fails
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } else {
    // Web browser - use standard window.open
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Sets up a global click handler to intercept external link clicks
 * and open them in the system browser when running in Tauri.
 * Should be called once at app initialization.
 */
export function setupExternalLinkHandler(): void {
  // Only set up handler if running in Tauri
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
  console.log('[openExternal] Setting up handler, isTauri:', isTauri);
  
  if (!isTauri) {
    return;
  }

  document.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    
    if (!anchor) return;
    
    const href = anchor.getAttribute('href');
    if (!href) return;
    
    console.log('[openExternal] Link clicked:', href);
    
    // Check if it's an external link (starts with http:// or https://)
    if (href.startsWith('http://') || href.startsWith('https://')) {
      // Check if it's not pointing to our app's backend
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      console.log('[openExternal] Backend URL:', backendUrl);
      if (!href.startsWith(backendUrl)) {
        console.log('[openExternal] Opening external URL:', href);
        event.preventDefault();
        event.stopPropagation();
        await openExternal(href);
      }
    }
  }, true); // Use capture phase to intercept before other handlers
}

