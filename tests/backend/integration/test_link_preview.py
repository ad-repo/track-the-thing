"""
Integration tests for /api/link-preview endpoint with mocked HTTP calls.
"""

import pytest
import requests
from fastapi.testclient import TestClient

from app.routers import link_preview


def make_response(html: str, status_code: int = 200):
    """Helper to mimic requests.Response."""

    class _Response:
        def __init__(self, body: str, status: int):
            self.content = body.encode('utf-8')
            self.status_code = status

        def raise_for_status(self):
            if self.status_code >= 400:
                raise requests.HTTPError(f'Status {self.status_code}')

    return _Response(html, status_code)


@pytest.mark.integration
class TestLinkPreviewAPI:
    """Ensure link preview endpoint parses metadata and handles failures."""

    def test_link_preview_returns_open_graph_metadata(self, client: TestClient, monkeypatch):
        """Open Graph tags should populate title/description/image."""
        html = """
        <html>
            <head>
                <meta property="og:title" content="Doc Title" />
                <meta property="og:description" content="Doc Description" />
                <meta property="og:image" content="https://cdn.example.com/img.png" />
                <meta property="og:site_name" content="Example" />
            </head>
        </html>
        """

        def fake_get(*args, **kwargs):
            return make_response(html)

        monkeypatch.setattr(link_preview.requests, 'get', fake_get)

        response = client.post('/api/link-preview/preview', json={'url': 'https://example.com/doc'})
        assert response.status_code == 200
        data = response.json()
        assert data['title'] == 'Doc Title'
        assert data['description'] == 'Doc Description'
        assert data['image'] == 'https://cdn.example.com/img.png'
        assert data['site_name'] == 'Example'

    def test_link_preview_handles_timeout(self, client: TestClient, monkeypatch):
        """Timeouts should return fallback payload."""

        def fake_timeout(*args, **kwargs):
            raise requests.exceptions.Timeout()

        monkeypatch.setattr(link_preview.requests, 'get', fake_timeout)

        response = client.post('/api/link-preview/preview', json={'url': 'https://slow.example.com'})
        assert response.status_code == 200
        data = response.json()
        assert data['title'] == 'slow.example.com'
        assert data['description'].startswith('Link preview not available')
