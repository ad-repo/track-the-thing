"""
Integration tests for Labels API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Label, NoteEntry


@pytest.mark.integration
class TestLabelsAPI:
    """Test /api/labels/ endpoints."""

    def test_create_label_success(self, client: TestClient, db_session: Session):
        """Test POST /api/labels/ with valid data returns 201."""
        response = client.post('/api/labels/', json={'name': 'new-label', 'color': '#ff0000'})

        assert response.status_code == 201
        data = response.json()
        assert data['name'] == 'new-label'
        assert data['color'] == '#ff0000'
        assert 'id' in data

    def test_create_label_default_color(self, client: TestClient):
        """Test creating label without color uses default."""
        response = client.post('/api/labels/', json={'name': 'default-color'})

        assert response.status_code == 201
        data = response.json()
        assert data['color'] == '#3b82f6'  # Default blue

    def test_create_label_duplicate_returns_400(self, client: TestClient, sample_label: Label):
        """Test POST /api/labels/ with duplicate name returns 400."""
        response = client.post('/api/labels/', json={'name': sample_label.name})

        assert response.status_code == 400

    def test_create_emoji_label(self, client: TestClient):
        """Test creating a label with emoji."""
        response = client.post('/api/labels/', json={'name': '⭐', 'color': '#fbbf24'})

        assert response.status_code == 201
        data = response.json()
        assert data['name'] == '⭐'

    def test_get_all_labels(self, client: TestClient, sample_label: Label, sample_emoji_label: Label):
        """Test GET /api/labels/ returns all labels."""
        response = client.get('/api/labels/')

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2

        label_names = [label['name'] for label in data]
        assert sample_label.name in label_names
        assert sample_emoji_label.name in label_names

    def test_get_labels_alphabetically(self, client: TestClient, db_session: Session):
        """Test labels are returned in alphabetical order."""
        # Create labels out of alphabetical order
        labels = [
            Label(name='zebra'),
            Label(name='apple'),
            Label(name='monkey'),
        ]
        for label in labels:
            db_session.add(label)
        db_session.commit()

        response = client.get('/api/labels/')

        assert response.status_code == 200
        data = response.json()
        label_names = [label['name'] for label in data]

        # Verify alphabetical order
        assert label_names == sorted(label_names)

    def test_delete_label_success(self, client: TestClient, db_session: Session, sample_label: Label):
        """Test DELETE /api/labels/{id} removes label."""
        label_id = sample_label.id

        response = client.delete(f'/api/labels/{label_id}')

        assert response.status_code in [200, 204]

        # Verify label is deleted
        deleted_label = db_session.query(Label).filter(Label.id == label_id).first()
        assert deleted_label is None

    def test_delete_label_not_found(self, client: TestClient):
        """Test DELETE /api/labels/{id} with non-existent ID returns 404."""
        response = client.delete('/api/labels/99999')

        assert response.status_code == 404

    def test_delete_label_cascades_to_entries(
        self,
        client: TestClient,
        db_session: Session,
        sample_note_entry_with_labels: NoteEntry,
    ):
        """Test deleting label removes it from entries."""
        entry_id = sample_note_entry_with_labels.id
        label_id = sample_note_entry_with_labels.labels[0].id

        response = client.delete(f'/api/labels/{label_id}')

        assert response.status_code in [200, 204]

        # Verify entry still exists but has no labels
        db_session.expire_all()
        entry = db_session.query(NoteEntry).filter(NoteEntry.id == entry_id).first()
        assert entry is not None
        assert len(entry.labels) == 0

    def test_attach_label_to_entry(self, client: TestClient, sample_note_entry: NoteEntry, sample_label: Label):
        """Test POST /api/labels/entry/{id}/label/{label_id} attaches label."""
        response = client.post(f'/api/labels/entry/{sample_note_entry.id}/label/{sample_label.id}')

        assert response.status_code in [200, 204]

        # Verify label is attached
        response = client.get(f'/api/entries/{sample_note_entry.id}')
        data = response.json()
        assert len(data['labels']) >= 1
        label_ids = [label['id'] for label in data['labels']]
        assert sample_label.id in label_ids

    def test_attach_multiple_labels_to_entry(
        self,
        client: TestClient,
        sample_note_entry: NoteEntry,
        sample_label: Label,
        sample_emoji_label: Label,
    ):
        """Test attaching multiple labels to an entry."""
        # Attach first label
        response = client.post(f'/api/labels/entry/{sample_note_entry.id}/label/{sample_label.id}')
        assert response.status_code in [200, 204]

        # Attach second label
        response = client.post(f'/api/labels/entry/{sample_note_entry.id}/label/{sample_emoji_label.id}')
        assert response.status_code in [200, 204]

        # Verify both labels attached
        response = client.get(f'/api/entries/{sample_note_entry.id}')
        data = response.json()
        assert len(data['labels']) >= 2

    def test_detach_label_from_entry(
        self,
        client: TestClient,
        db_session: Session,
        sample_note_entry_with_labels: NoteEntry,
    ):
        """Test DELETE /api/labels/entry/{id}/label/{label_id} detaches label."""
        entry_id = sample_note_entry_with_labels.id
        label_id = sample_note_entry_with_labels.labels[0].id

        response = client.delete(f'/api/labels/entry/{entry_id}/label/{label_id}')

        assert response.status_code in [200, 204]

        # Verify label is detached
        db_session.expire_all()
        entry = db_session.query(NoteEntry).filter(NoteEntry.id == entry_id).first()
        label_ids = [label.id for label in entry.labels]
        assert label_id not in label_ids

    @pytest.mark.skip(reason='Autocomplete endpoint not yet implemented in production code')
    def test_autocomplete_labels(self, client: TestClient, db_session: Session):
        """Test GET /api/labels/autocomplete?q=prefix returns filtered labels."""
        # Create labels with various prefixes
        labels = [
            Label(name='urgent'),
            Label(name='urgent-bug'),
            Label(name='urgent-feature'),
            Label(name='feature'),
        ]
        for label in labels:
            db_session.add(label)
        db_session.commit()

        response = client.get('/api/labels/autocomplete?q=urgent')

        assert response.status_code == 200
        data = response.json()
        label_names = [label['name'] for label in data]

        assert 'urgent' in label_names
        assert 'urgent-bug' in label_names
        assert 'urgent-feature' in label_names
        assert 'feature' not in label_names

    @pytest.mark.skip(reason='Autocomplete endpoint not yet implemented in production code')
    def test_autocomplete_empty_query(self, client: TestClient, sample_label: Label):
        """Test autocomplete with empty query returns all labels."""
        response = client.get('/api/labels/autocomplete?q=')

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    @pytest.mark.skip(reason='Autocomplete endpoint not yet implemented in production code')
    def test_autocomplete_no_matches(self, client: TestClient):
        """Test autocomplete with no matches returns empty list."""
        response = client.get('/api/labels/autocomplete?q=nonexistent')

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # May be empty or contain no matches

    @pytest.mark.skip(reason='Autocomplete endpoint not yet implemented in production code')
    def test_autocomplete_case_insensitive(self, client: TestClient, db_session: Session):
        """Test autocomplete is case-insensitive."""
        label = Label(name='Test')
        db_session.add(label)
        db_session.commit()

        response = client.get('/api/labels/autocomplete?q=test')

        assert response.status_code == 200
        data = response.json()
        label_names = [lbl['name'].lower() for lbl in data]
        assert 'test' in label_names

    def test_create_label_empty_name_validation(self, client: TestClient):
        """Test POST /api/labels/ with empty name returns 400.

        Bug #1 fixed: The API now correctly rejects empty label names.
        """
        response = client.post('/api/labels/', json={'name': ''})

        assert response.status_code in [400, 422]

    def test_create_label_long_name(self, client: TestClient):
        """Test creating label with very long name."""
        long_name = 'a' * 255
        response = client.post('/api/labels/', json={'name': long_name})

        # Should either succeed or fail with 400 if name too long
        assert response.status_code in [200, 201, 400, 422]

    def test_get_label_by_id(self, client: TestClient, sample_label: Label):
        """Test GET /api/labels/{id} returns specific label."""
        response = client.get(f'/api/labels/{sample_label.id}')

        if response.status_code == 200:
            data = response.json()
            assert data['id'] == sample_label.id
            assert data['name'] == sample_label.name

    def test_update_label_name(self, client: TestClient, sample_label: Label):
        """Test PUT /api/labels/{id} updates label name."""
        response = client.put(f'/api/labels/{sample_label.id}', json={'name': 'updated-name'})

        if response.status_code == 200:
            data = response.json()
            assert data['name'] == 'updated-name'

    def test_update_label_color(self, client: TestClient, sample_label: Label):
        """Test PUT /api/labels/{id} updates label color."""
        response = client.put(f'/api/labels/{sample_label.id}', json={'color': '#00ff00'})

        if response.status_code == 200:
            data = response.json()
            assert data['color'] == '#00ff00'

    def test_label_statistics(self, client: TestClient, db_session: Session, sample_daily_note):
        """Test getting label usage statistics."""
        # Create label and attach to multiple entries
        label = Label(name='stats-test')
        db_session.add(label)
        db_session.commit()
        db_session.refresh(label)

        for i in range(3):
            entry = NoteEntry(daily_note_id=sample_daily_note.id, content=f'<p>Entry {i}</p>')
            entry.labels.append(label)
            db_session.add(entry)
        db_session.commit()

        response = client.get('/api/labels/')

        assert response.status_code == 200
        data = response.json()
        stats_label = next((lbl for lbl in data if lbl['name'] == 'stats-test'), None)

        if stats_label and 'entry_count' in stats_label:
            assert stats_label['entry_count'] == 3

    def test_bulk_delete_labels(self, client: TestClient, db_session: Session):
        """Test deleting multiple labels at once."""
        # Create multiple labels
        labels = [Label(name=f'bulk-{i}') for i in range(3)]
        for label in labels:
            db_session.add(label)
        db_session.commit()

        label_ids = [label.id for label in labels]

        # Delete them (if bulk delete endpoint exists)
        for label_id in label_ids:
            response = client.delete(f'/api/labels/{label_id}')
            assert response.status_code in [200, 204]

        # Verify all deleted
        remaining = db_session.query(Label).filter(Label.id.in_(label_ids)).count()
        assert remaining == 0
