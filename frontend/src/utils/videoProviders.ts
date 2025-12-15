/**
 * Video Provider Registry
 * 
 * Extensible system for detecting and handling video URLs from various providers.
 * To add a new provider, simply add it to the PROVIDERS array.
 */

export interface VideoProvider {
  name: string;
  /** Regex patterns to match video URLs. First capture group should be the video ID. */
  patterns: RegExp[];
  /** Generate the embed URL for an iframe. */
  getEmbedUrl: (videoId: string) => string;
  /** Generate a thumbnail URL (if available without API). */
  getThumbnailUrl?: (videoId: string) => string;
  /** Icon color for the provider badge */
  color?: string;
}

export interface VideoMatch {
  provider: VideoProvider;
  videoId: string;
  embedUrl: string;
  thumbnailUrl?: string;
}

// YouTube provider
const youtubeProvider: VideoProvider = {
  name: 'YouTube',
  patterns: [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ],
  getEmbedUrl: (videoId) => `https://www.youtube.com/embed/${videoId}`,
  getThumbnailUrl: (videoId) => `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  color: '#FF0000',
};

// Vimeo provider
const vimeoProvider: VideoProvider = {
  name: 'Vimeo',
  patterns: [
    /vimeo\.com\/(\d+)/,
    /vimeo\.com\/video\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ],
  getEmbedUrl: (videoId) => `https://player.vimeo.com/video/${videoId}`,
  // Vimeo thumbnails require API call, handled by backend
  color: '#1AB7EA',
};

// Dailymotion provider
const dailymotionProvider: VideoProvider = {
  name: 'Dailymotion',
  patterns: [
    /dailymotion\.com\/video\/([a-zA-Z0-9]+)/,
    /dai\.ly\/([a-zA-Z0-9]+)/,
  ],
  getEmbedUrl: (videoId) => `https://www.dailymotion.com/embed/video/${videoId}`,
  getThumbnailUrl: (videoId) => `https://www.dailymotion.com/thumbnail/video/${videoId}`,
  color: '#00D2F3',
};

// Twitch clips provider
const twitchClipProvider: VideoProvider = {
  name: 'Twitch',
  patterns: [
    /clips\.twitch\.tv\/([a-zA-Z0-9_-]+)/,
    /twitch\.tv\/\w+\/clip\/([a-zA-Z0-9_-]+)/,
  ],
  getEmbedUrl: (clipId) => `https://clips.twitch.tv/embed?clip=${clipId}&parent=${window.location.hostname}`,
  color: '#9146FF',
};

// Twitch videos provider
const twitchVideoProvider: VideoProvider = {
  name: 'Twitch',
  patterns: [
    /twitch\.tv\/videos\/(\d+)/,
  ],
  getEmbedUrl: (videoId) => `https://player.twitch.tv/?video=${videoId}&parent=${window.location.hostname}`,
  color: '#9146FF',
};

// Provider registry - add new providers here
export const PROVIDERS: VideoProvider[] = [
  youtubeProvider,
  vimeoProvider,
  dailymotionProvider,
  twitchClipProvider,
  twitchVideoProvider,
];

/**
 * Detect if a URL matches any known video provider.
 * Returns match info or null if not a recognized video URL.
 */
export function detectVideoProvider(url: string): VideoMatch | null {
  for (const provider of PROVIDERS) {
    for (const pattern of provider.patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        const videoId = match[1];
        return {
          provider,
          videoId,
          embedUrl: provider.getEmbedUrl(videoId),
          thumbnailUrl: provider.getThumbnailUrl?.(videoId),
        };
      }
    }
  }
  return null;
}

/**
 * Check if a URL is a video URL from any supported provider.
 */
export function isVideoUrl(url: string): boolean {
  return detectVideoProvider(url) !== null;
}

