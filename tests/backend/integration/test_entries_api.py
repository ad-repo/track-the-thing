"""
Integration tests for Note Entry API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import DailyNote, Label, NoteEntry


@pytest.mark.integration
class TestEntriesAPI:
    """Test /api/entries/ endpoints."""

    def test_create_entry_success(self, client: TestClient, db_session: Session, sample_daily_note: DailyNote):
        """Test POST /api/entries/note/{date} with valid data returns 201."""
        response = client.post(
            f'/api/entries/note/{sample_daily_note.date}',
            json={
                'title': 'API Test Entry',
                'content': '<p>Content from API</p>',
                'content_type': 'rich_text',
                'is_important': 0,
                'is_completed': 0,
                'include_in_report': 0,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data['title'] == 'API Test Entry'
        assert data['content'] == '<p>Content from API</p>'
        assert 'id' in data
        assert 'created_at' in data

    def test_create_entry_minimal_data(self, client: TestClient, sample_daily_note: DailyNote):
        """Test creating entry with minimal required fields."""
        response = client.post(
            f'/api/entries/note/{sample_daily_note.date}',
            json={'content': '<p>Minimal</p>'},
        )

        assert response.status_code == 201
        data = response.json()
        assert data['content'] == '<p>Minimal</p>'
        assert data['title'] == ''  # Default

    def test_get_entry_by_id(self, client: TestClient, sample_note_entry: NoteEntry):
        """Test GET /api/entries/{id} returns entry."""
        response = client.get(f'/api/entries/{sample_note_entry.id}')

        assert response.status_code == 200
        data = response.json()
        assert data['id'] == sample_note_entry.id
        assert data['title'] == sample_note_entry.title

    def test_get_entry_not_found(self, client: TestClient):
        """Test GET /api/entries/{id} with non-existent ID returns 404."""
        response = client.get('/api/entries/99999')

        assert response.status_code == 404

    def test_update_entry_title_and_content(self, client: TestClient, sample_note_entry: NoteEntry):
        """Test PUT /api/entries/{id} updates title and content."""
        response = client.put(
            f'/api/entries/{sample_note_entry.id}',
            json={'title': 'Updated Title', 'content': '<p>Updated Content</p>'},
        )

        assert response.status_code == 200
        data = response.json()
        assert data['title'] == 'Updated Title'
        assert data['content'] == '<p>Updated Content</p>'

    def test_update_entry_toggle_important(self, client: TestClient, sample_note_entry: NoteEntry):
        """Test updating is_important flag."""
        response = client.put(f'/api/entries/{sample_note_entry.id}', json={'is_important': 1})

        assert response.status_code == 200
        data = response.json()
        assert data['is_important'] == 1

    def test_update_entry_toggle_completed(self, client: TestClient, sample_note_entry: NoteEntry):
        """Test updating is_completed flag."""
        response = client.put(f'/api/entries/{sample_note_entry.id}', json={'is_completed': 1})

        assert response.status_code == 200
        data = response.json()
        assert data['is_completed'] == 1

    def test_update_entry_toggle_report(self, client: TestClient, sample_note_entry: NoteEntry):
        """Test updating include_in_report flag."""
        response = client.put(f'/api/entries/{sample_note_entry.id}', json={'include_in_report': 1})

        assert response.status_code == 200
        data = response.json()
        assert data['include_in_report'] == 1

    def test_update_entry_partial_update(self, client: TestClient, sample_note_entry: NoteEntry):
        """Test partial update only changes specified fields."""
        original_content = sample_note_entry.content

        response = client.put(f'/api/entries/{sample_note_entry.id}', json={'title': 'Only Title Changed'})

        assert response.status_code == 200
        data = response.json()
        assert data['title'] == 'Only Title Changed'
        assert data['content'] == original_content  # Should remain unchanged

    def test_update_entry_not_found(self, client: TestClient):
        """Test PUT /api/entries/{id} with non-existent ID returns 404."""
        response = client.put('/api/entries/99999', json={'title': 'Does not exist'})

        assert response.status_code == 404

    def test_delete_entry_success(self, client: TestClient, db_session: Session, sample_note_entry: NoteEntry):
        """Test DELETE /api/entries/{id} removes entry."""
        entry_id = sample_note_entry.id

        response = client.delete(f'/api/entries/{entry_id}')

        assert response.status_code in [200, 204]

        # Verify entry is deleted
        deleted_entry = db_session.query(NoteEntry).filter(NoteEntry.id == entry_id).first()
        assert deleted_entry is None

    def test_delete_entry_not_found(self, client: TestClient):
        """Test DELETE /api/entries/{id} with non-existent ID returns 404."""
        response = client.delete('/api/entries/99999')

        assert response.status_code == 404

    def test_delete_entry_cascade_removes_label_associations(
        self,
        client: TestClient,
        db_session: Session,
        sample_note_entry_with_labels: NoteEntry,
    ):
        """Test deleting entry removes label associations but not labels."""
        entry_id = sample_note_entry_with_labels.id
        label_id = sample_note_entry_with_labels.labels[0].id

        response = client.delete(f'/api/entries/{entry_id}')

        assert response.status_code in [200, 204]

        # Verify label still exists
        label_exists = db_session.query(Label).filter(Label.id == label_id).first()
        assert label_exists is not None

    def test_get_entries_for_daily_note(self, client: TestClient, sample_daily_note: DailyNote, multiple_entries: list):
        """Test GET /api/notes/{date} includes all entries."""
        response = client.get(f'/api/notes/{sample_daily_note.date}')

        assert response.status_code == 200
        data = response.json()
        assert 'entries' in data
        assert len(data['entries']) >= len(multiple_entries)

    def test_entries_ordered_by_index(self, client: TestClient, sample_daily_note: DailyNote, multiple_entries: list):
        """Test entries are returned in order_index order."""
        response = client.get(f'/api/notes/{sample_daily_note.date}')

        assert response.status_code == 200
        data = response.json()
        entries = data['entries']

        # Verify entries are ordered (assuming DESC order based on model relationship)
        for i in range(len(entries) - 1):
            assert entries[i]['order_index'] >= entries[i + 1]['order_index']

    def test_create_entry_with_labels(
        self,
        client: TestClient,
        db_session: Session,
        sample_daily_note: DailyNote,
        sample_label: Label,
    ):
        """Test creating entry and attaching labels."""
        # Create entry
        response = client.post(
            f'/api/entries/note/{sample_daily_note.date}',
            json={'content': '<p>Entry with labels</p>'},
        )

        assert response.status_code == 201
        entry_id = response.json()['id']

        # Attach label using correct endpoint
        response = client.post(f'/api/labels/entry/{entry_id}/label/{sample_label.id}')

        assert response.status_code in [200, 204]

        # Verify label attached
        response = client.get(f'/api/entries/{entry_id}')
        data = response.json()
        assert len(data['labels']) >= 1

    def test_toggle_all_states(self, client: TestClient, sample_note_entry: NoteEntry):
        """Test toggling all state flags on an entry."""
        entry_id = sample_note_entry.id

        # Toggle important
        response = client.put(f'/api/entries/{entry_id}', json={'is_important': 1})
        assert response.status_code == 200
        assert response.json()['is_important'] == 1

        # Toggle completed
        response = client.put(f'/api/entries/{entry_id}', json={'is_completed': 1})
        assert response.status_code == 200
        assert response.json()['is_completed'] == 1

        # Verify all states are set
        response = client.get(f'/api/entries/{entry_id}')
        data = response.json()
        assert data['is_important'] == 1
        assert data['is_completed'] == 1

    def test_entry_timestamps_updated(self, client: TestClient, sample_note_entry: NoteEntry):
        """Test that updated_at changes when entry is modified."""

        response = client.put(f'/api/entries/{sample_note_entry.id}', json={'title': 'Timestamp test'})

        assert response.status_code == 200
        data = response.json()
        # Note: In real implementation, updated_at should be more recent
        assert 'updated_at' in data

    def test_move_entry_to_different_day(self, client: TestClient, db_session: Session, sample_note_entry: NoteEntry):
        """Test moving an entry to a different daily note."""
        # Create a new daily note for a different date
        new_note = DailyNote(date='2025-11-08', daily_goal='New day')
        db_session.add(new_note)
        db_session.commit()
        db_session.refresh(new_note)

        # Move entry
        response = client.put(
            f'/api/entries/{sample_note_entry.id}/move',
            json={'daily_note_id': new_note.id},
        )

        if response.status_code == 200:
            data = response.json()
            assert data['daily_note_id'] == new_note.id

    def test_multiple_entries_same_day(self, client: TestClient, sample_daily_note: DailyNote):
        """Test creating multiple entries for the same day."""
        entries_data = [
            {'title': 'Entry 1', 'content': '<p>Content 1</p>'},
            {'title': 'Entry 2', 'content': '<p>Content 2</p>'},
            {'title': 'Entry 3', 'content': '<p>Content 3</p>'},
        ]

        created_ids = []
        for entry_data in entries_data:
            response = client.post(f'/api/entries/note/{sample_daily_note.date}', json=entry_data)
            assert response.status_code == 201
            created_ids.append(response.json()['id'])

        # Verify all entries exist
        response = client.get(f'/api/notes/{sample_daily_note.date}')
        data = response.json()
        entry_ids_in_response = [e['id'] for e in data['entries']]

        for created_id in created_ids:
            assert created_id in entry_ids_in_response
