import io
import json

import pytest
from fastapi import HTTPException, UploadFile

from app.routers import backup


class DummyDB:
    """Minimal DB stub to satisfy backup router interactions without real I/O."""

    def __init__(self):
        self.begin_called = False
        self.commit_called = False
        self.rollback_called = False
        self.added = []

    def begin(self):
        self.begin_called = True

        class _Ctx:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        return _Ctx()

    def query(self, *args, **kwargs):
        return self

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return None

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.commit_called = True

    def rollback(self):
        self.rollback_called = True


def make_upload(filename: str, content: bytes) -> UploadFile:
    return UploadFile(filename=filename, file=io.BytesIO(content))


@pytest.mark.asyncio
@pytest.mark.unit
async def test_import_data_rejects_invalid_json():
    db = DummyDB()
    bad_file = make_upload('backup.json', b'not-json')

    with pytest.raises(HTTPException) as exc:
        await backup.import_data(bad_file, db=db, replace=False)  # type: ignore[arg-type]

    assert exc.value.status_code == 400
    assert exc.value.detail == 'Invalid JSON file'
    assert db.begin_called is False  # failed before touching the DB


@pytest.mark.asyncio
@pytest.mark.unit
async def test_import_data_validates_required_keys():
    db = DummyDB()
    missing_keys = make_upload('backup.json', json.dumps({'notes': []}).encode())

    with pytest.raises(HTTPException) as exc:
        await backup.import_data(missing_keys, db=db, replace=False)  # type: ignore[arg-type]

    assert exc.value.status_code == 400
    assert exc.value.detail == 'Invalid backup file format'
    assert db.begin_called is False


@pytest.mark.asyncio
@pytest.mark.unit
async def test_full_restore_rejects_bad_extensions():
    db = DummyDB()
    backup_file = make_upload('backup.txt', b'{}')
    archive = make_upload('files.tar', b'')

    with pytest.raises(HTTPException) as exc:
        await backup.full_restore(backup_file, archive, db=db, replace=False)  # type: ignore[arg-type]

    assert exc.value.status_code == 400
    assert 'Backup file must be a JSON file' in exc.value.detail
    assert db.commit_called is False


@pytest.mark.asyncio
@pytest.mark.unit
async def test_full_restore_invalid_zip_triggers_rollback():
    db = DummyDB()
    minimal_backup = make_upload('backup.json', json.dumps({'version': 1, 'notes': []}).encode())
    invalid_zip = make_upload('files.zip', b'not-a-zip')

    with pytest.raises(HTTPException) as exc:
        await backup.full_restore(minimal_backup, invalid_zip, db=db, replace=False)  # type: ignore[arg-type]

    assert exc.value.status_code == 400
    assert exc.value.detail == 'Invalid ZIP file'
    assert db.commit_called is True  # data phase committed
    assert db.rollback_called is True  # rolled back after zip failure
