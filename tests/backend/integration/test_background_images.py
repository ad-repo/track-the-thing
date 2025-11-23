"""
Integration tests for /api/background-images endpoints.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.routers import background_images


@pytest.fixture(autouse=True)
def temp_background_dir(monkeypatch, tmp_path):
    """Redirect background image storage to a temporary directory."""
    bg_dir = tmp_path / 'backgrounds'
    bg_dir.mkdir()
    metadata_file = bg_dir / 'metadata.json'
    monkeypatch.setattr(background_images, 'BACKGROUNDS_DIR', bg_dir)
    monkeypatch.setattr(background_images, 'METADATA_FILE', metadata_file)
    yield bg_dir


@pytest.mark.integration
class TestBackgroundImagesAPI:
    """Verify upload/list/delete flows for background images."""

    def test_upload_and_list_background_images(self, client: TestClient, temp_background_dir: Path):
        """Uploading an image should persist metadata and be listed."""
        files = {'file': ('wallpaper.png', b'\x89PNG\r\n\x1a\n' + b'\x00' * 10, 'image/png')}

        upload_response = client.post('/api/background-images/upload', files=files)
        assert upload_response.status_code == 200
        data = upload_response.json()
        assert data['filename'].endswith('.png')
        assert (temp_background_dir / data['filename']).exists()

        list_response = client.get('/api/background-images/list')
        assert list_response.status_code == 200
        items = list_response.json()
        assert len(items) == 1
        assert items[0]['id'] == data['id']

    def test_upload_rejects_non_image(self, client: TestClient):
        """Non-image uploads should be rejected."""
        files = {'file': ('notes.txt', b'not image data', 'text/plain')}

        response = client.post('/api/background-images/upload', files=files)
        assert response.status_code == 400

    def test_get_background_image_returns_file(self, client: TestClient):
        """Uploaded file should be retrievable."""
        files = {'file': ('wallpaper.jpg', b'\xff\xd8\xff' + b'\x00' * 10, 'image/jpeg')}
        upload_response = client.post('/api/background-images/upload', files=files)
        filename = upload_response.json()['filename']

        fetch_response = client.get(f'/api/background-images/image/{filename}')
        assert fetch_response.status_code == 200
        assert fetch_response.content.startswith(b'\xff\xd8\xff')

    def test_delete_background_image_removes_file(self, client: TestClient, temp_background_dir: Path):
        """DELETE should remove file and metadata."""
        files = {'file': ('bg.png', b'\x89PNG\r\n\x1a\n' + b'\x00' * 8, 'image/png')}
        upload_response = client.post('/api/background-images/upload', files=files)
        data = upload_response.json()
        file_path = temp_background_dir / data['filename']
        assert file_path.exists()

        delete_response = client.delete(f"/api/background-images/{data['id']}")
        assert delete_response.status_code == 200
        assert not file_path.exists()

        list_response = client.get('/api/background-images/list')
        assert list_response.json() == []
