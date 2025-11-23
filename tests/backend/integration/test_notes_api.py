"""
Integration tests for /api/notes endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import DailyNote, NoteEntry


@pytest.mark.integration
class TestNotesAPI:
    """Ensure daily note CRUD flows are covered."""

    def test_create_note_and_list(self, client: TestClient):
        """POST should create a note that appears in GET /api/notes."""
        payload = {
            'date': '2025-11-07',
            'fire_rating': 3,
            'daily_goal': 'Finish sprint',
        }

        create_response = client.post('/api/notes/', json=payload)
        assert create_response.status_code == 201

        list_response = client.get('/api/notes/')
        assert list_response.status_code == 200
        notes = list_response.json()
        assert notes[0]['date'] == '2025-11-07'
        assert notes[0]['daily_goal'] == 'Finish sprint'
        assert notes[0]['entries'] == []

    def test_create_note_duplicate_date_returns_400(self, client: TestClient):
        """Creating a note twice for the same date should fail."""
        payload = {'date': '2025-11-08', 'fire_rating': 2, 'daily_goal': 'First'}
        assert client.post('/api/notes/', json=payload).status_code == 201

        duplicate_response = client.post('/api/notes/', json=payload)
        assert duplicate_response.status_code == 400

    def test_update_note_changes_fields(self, client: TestClient):
        """PUT should update fire rating and goal."""
        payload = {'date': '2025-11-09', 'fire_rating': 1, 'daily_goal': 'Initial'}
        client.post('/api/notes/', json=payload)

        update_response = client.put('/api/notes/2025-11-09', json={'fire_rating': 5, 'daily_goal': 'Updated'})
        assert update_response.status_code == 200
        data = update_response.json()
        assert data['fire_rating'] == 5
        assert data['daily_goal'] == 'Updated'

    def test_delete_note_removes_entries(self, client: TestClient, db_session: Session):
        """Deleting a note should cascade to entries."""
        note = DailyNote(date='2025-11-10', fire_rating=3, daily_goal='Delete me')
        db_session.add(note)
        db_session.commit()
        entry = NoteEntry(daily_note_id=note.id, content='<p>linked</p>')
        db_session.add(entry)
        db_session.commit()

        delete_response = client.delete('/api/notes/2025-11-10')
        assert delete_response.status_code == 204
        assert db_session.query(DailyNote).count() == 0
        assert db_session.query(NoteEntry).count() == 0

    def test_get_note_by_date_includes_entry_metadata(self, client: TestClient, db_session: Session):
        """GET /api/notes/{date} should return entries with daily_note_date."""
        note = DailyNote(date='2025-11-11', fire_rating=4, daily_goal='Inspect')
        db_session.add(note)
        db_session.commit()
        entry = NoteEntry(daily_note_id=note.id, title='Entry', content='<p>content</p>')
        db_session.add(entry)
        db_session.commit()

        response = client.get('/api/notes/2025-11-11')
        assert response.status_code == 200
        data = response.json()
        assert data['date'] == '2025-11-11'
        assert data['entries'][0]['daily_note_date'] == '2025-11-11'

    def test_get_notes_by_month_filters_range(self, client: TestClient, db_session: Session):
        """GET /api/notes/month/{year}/{month} should only return requested month."""
        notes = [
            DailyNote(date='2025-11-01', fire_rating=2),
            DailyNote(date='2025-11-15', fire_rating=4),
            DailyNote(date='2025-12-01', fire_rating=5),
        ]
        db_session.add_all(notes)
        db_session.commit()

        response = client.get('/api/notes/month/2025/11')
        assert response.status_code == 200
        data = response.json()
        assert [note['date'] for note in data] == ['2025-11-01', '2025-11-15']
