"""
Integration tests for /api/uploads endpoints.
"""

import io
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.routers import uploads


@pytest.fixture(autouse=True)
def temp_upload_dir(monkeypatch, tmp_path):
    """Redirect upload storage to a temporary directory."""
    upload_dir = tmp_path / 'uploads'
    upload_dir.mkdir()
    monkeypatch.setattr(uploads, 'UPLOAD_DIR', upload_dir)
    yield upload_dir


@pytest.mark.integration
class TestUploadsAPI:
    """Verify upload, download, and restore workflows."""

    def test_upload_image_and_fetch(self, client: TestClient, temp_upload_dir: Path):
        """Image upload should persist file retrievable via GET."""
        files = {'file': ('photo.png', b'\x89PNG\r\n\x1a\n' + b'\x00' * 12, 'image/png')}

        response = client.post('/api/uploads/image', files=files)
        assert response.status_code == 200
        data = response.json()
        stored_name = data['url'].split('/')[-1]
        assert (temp_upload_dir / stored_name).exists()

        download_response = client.get(f'/api/uploads/files/{stored_name}')
        assert download_response.status_code == 200
        assert download_response.content.startswith(b'\x89PNG')

    def test_upload_file_returns_size_and_type(self, client: TestClient):
        """Generic file upload should report metadata."""
        payload = {'file': ('notes.md', b'# Notes', 'text/markdown')}

        response = client.post('/api/uploads/file', files=payload)
        assert response.status_code == 200
        data = response.json()
        assert data['filename'] == 'notes.md'
        assert data['size'] == len(b'# Notes')
        assert data['content_type'] == 'text/markdown'

    def test_upload_image_rejects_invalid_type(self, client: TestClient):
        """Uploading non-image to /image endpoint should fail."""
        payload = {'file': ('data.bin', b'xyz', 'application/octet-stream')}

        response = client.post('/api/uploads/image', files=payload)
        assert response.status_code == 400

    def test_download_all_files_returns_zip(self, client: TestClient):
        """download-all should stream a zip containing uploaded files."""
        files = {'file': ('doc.txt', b'hello', 'text/plain')}
        client.post('/api/uploads/file', files=files)

        response = client.get('/api/uploads/download-all')
        assert response.status_code == 200
        assert response.headers['content-type'] == 'application/zip'

        buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(buffer) as zf:
            names = zf.namelist()
            assert len(names) == 1
            assert names[0].endswith('.txt')

    def test_restore_files_installs_zip_contents(self, client: TestClient, temp_upload_dir: Path):
        """restore-files should extract new files while skipping duplicates."""
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zf:
            zf.writestr('first.txt', 'one')
            zf.writestr('second.txt', 'two')
        zip_buffer.seek(0)

        files = {'file': ('uploads.zip', zip_buffer.read(), 'application/zip')}
        response = client.post('/api/uploads/restore-files', files=files)
        assert response.status_code == 200
        data = response.json()
        assert data['stats']['restored'] == 2

        # Re-run restore to trigger skips
        zip_buffer.seek(0)
        files = {'file': ('uploads.zip', zip_buffer.getvalue(), 'application/zip')}
        skip_response = client.post('/api/uploads/restore-files', files=files)
        assert skip_response.status_code == 200
        assert skip_response.json()['stats']['skipped'] == 2
