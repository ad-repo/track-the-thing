"""oEmbed API for fetching video metadata from various providers."""

import re
from urllib.parse import urlparse

import requests
from fastapi import APIRouter
from pydantic import BaseModel, HttpUrl

router = APIRouter()


class OEmbedRequest(BaseModel):
    url: HttpUrl


class OEmbedResponse(BaseModel):
    url: str
    title: str | None = None
    thumbnail_url: str | None = None
    provider_name: str | None = None
    author_name: str | None = None
    html: str | None = None
    video_id: str | None = None
    embed_url: str | None = None


# oEmbed endpoints for various providers
OEMBED_ENDPOINTS = {
    'youtube': 'https://www.youtube.com/oembed',
    'vimeo': 'https://vimeo.com/api/oembed.json',
    'dailymotion': 'https://www.dailymotion.com/services/oembed',
    'twitch': 'https://api.twitch.tv/v5/oembed',  # Note: may require client-id
}


def extract_youtube_id(url: str) -> str | None:
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
        r'youtu\.be/([a-zA-Z0-9_-]{11})',
        r'youtube\.com/embed/([a-zA-Z0-9_-]{11})',
        r'youtube\.com/v/([a-zA-Z0-9_-]{11})',
        r'youtube\.com/shorts/([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def extract_vimeo_id(url: str) -> str | None:
    """Extract Vimeo video ID from URL."""
    patterns = [
        r'vimeo\.com/(\d+)',
        r'vimeo\.com/video/(\d+)',
        r'player\.vimeo\.com/video/(\d+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def extract_dailymotion_id(url: str) -> str | None:
    """Extract Dailymotion video ID from URL."""
    patterns = [
        r'dailymotion\.com/video/([a-zA-Z0-9]+)',
        r'dai\.ly/([a-zA-Z0-9]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def extract_twitch_info(url: str) -> tuple[str | None, str | None]:
    """Extract Twitch clip/video info from URL. Returns (type, id)."""
    # Clips
    clip_patterns = [
        r'clips\.twitch\.tv/([a-zA-Z0-9_-]+)',
        r'twitch\.tv/\w+/clip/([a-zA-Z0-9_-]+)',
    ]
    for pattern in clip_patterns:
        match = re.search(pattern, url)
        if match:
            return ('clip', match.group(1))

    # Videos
    video_patterns = [
        r'twitch\.tv/videos/(\d+)',
    ]
    for pattern in video_patterns:
        match = re.search(pattern, url)
        if match:
            return ('video', match.group(1))

    return (None, None)


def detect_provider(url: str) -> str | None:
    """Detect which video provider the URL belongs to."""
    parsed = urlparse(url)
    domain = parsed.netloc.lower().replace('www.', '')

    if 'youtube.com' in domain or 'youtu.be' in domain:
        return 'youtube'
    elif 'vimeo.com' in domain or 'player.vimeo.com' in domain:
        return 'vimeo'
    elif 'dailymotion.com' in domain or 'dai.ly' in domain:
        return 'dailymotion'
    elif 'twitch.tv' in domain or 'clips.twitch.tv' in domain:
        return 'twitch'

    return None


def fetch_youtube_oembed(url: str, video_id: str) -> OEmbedResponse:
    """Fetch YouTube video metadata via oEmbed."""
    try:
        response = requests.get(
            OEMBED_ENDPOINTS['youtube'],
            params={'url': url, 'format': 'json'},
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()

        return OEmbedResponse(
            url=url,
            title=data.get('title'),
            thumbnail_url=f'https://img.youtube.com/vi/{video_id}/hqdefault.jpg',
            provider_name='YouTube',
            author_name=data.get('author_name'),
            html=data.get('html'),
            video_id=video_id,
            embed_url=f'https://www.youtube.com/embed/{video_id}',
        )
    except Exception:
        # Fallback with just the video ID
        return OEmbedResponse(
            url=url,
            title=None,
            thumbnail_url=f'https://img.youtube.com/vi/{video_id}/hqdefault.jpg',
            provider_name='YouTube',
            video_id=video_id,
            embed_url=f'https://www.youtube.com/embed/{video_id}',
        )


def fetch_vimeo_oembed(url: str, video_id: str) -> OEmbedResponse:
    """Fetch Vimeo video metadata via oEmbed."""
    try:
        response = requests.get(
            OEMBED_ENDPOINTS['vimeo'],
            params={'url': url},
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()

        return OEmbedResponse(
            url=url,
            title=data.get('title'),
            thumbnail_url=data.get('thumbnail_url'),
            provider_name='Vimeo',
            author_name=data.get('author_name'),
            html=data.get('html'),
            video_id=video_id,
            embed_url=f'https://player.vimeo.com/video/{video_id}',
        )
    except Exception:
        return OEmbedResponse(
            url=url,
            provider_name='Vimeo',
            video_id=video_id,
            embed_url=f'https://player.vimeo.com/video/{video_id}',
        )


def fetch_dailymotion_oembed(url: str, video_id: str) -> OEmbedResponse:
    """Fetch Dailymotion video metadata via oEmbed."""
    try:
        response = requests.get(
            OEMBED_ENDPOINTS['dailymotion'],
            params={'url': url, 'format': 'json'},
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()

        return OEmbedResponse(
            url=url,
            title=data.get('title'),
            thumbnail_url=data.get('thumbnail_url'),
            provider_name='Dailymotion',
            author_name=data.get('author_name'),
            html=data.get('html'),
            video_id=video_id,
            embed_url=f'https://www.dailymotion.com/embed/video/{video_id}',
        )
    except Exception:
        return OEmbedResponse(
            url=url,
            provider_name='Dailymotion',
            video_id=video_id,
            embed_url=f'https://www.dailymotion.com/embed/video/{video_id}',
        )


def fetch_twitch_info(url: str, twitch_type: str, twitch_id: str) -> OEmbedResponse:
    """Fetch Twitch clip/video info."""
    # Twitch oEmbed requires authentication, so we just construct embed URLs
    if twitch_type == 'clip':
        embed_url = f'https://clips.twitch.tv/embed?clip={twitch_id}&parent=localhost'
    else:
        embed_url = f'https://player.twitch.tv/?video={twitch_id}&parent=localhost'

    return OEmbedResponse(
        url=url,
        provider_name='Twitch',
        video_id=twitch_id,
        embed_url=embed_url,
    )


@router.post('/info', response_model=OEmbedResponse)
async def get_oembed_info(request: OEmbedRequest):
    """Fetch oEmbed metadata for a video URL."""
    url = str(request.url)
    provider = detect_provider(url)

    if provider == 'youtube':
        video_id = extract_youtube_id(url)
        if video_id:
            return fetch_youtube_oembed(url, video_id)

    elif provider == 'vimeo':
        video_id = extract_vimeo_id(url)
        if video_id:
            return fetch_vimeo_oembed(url, video_id)

    elif provider == 'dailymotion':
        video_id = extract_dailymotion_id(url)
        if video_id:
            return fetch_dailymotion_oembed(url, video_id)

    elif provider == 'twitch':
        twitch_type, twitch_id = extract_twitch_info(url)
        if twitch_id:
            return fetch_twitch_info(url, twitch_type, twitch_id)

    # Unknown provider or couldn't extract ID
    return OEmbedResponse(url=url)
