"""
Integration tests for Backup & Restore API endpoints

Per .cursorrules: These tests do not modify production code.
Tests validate existing backup/restore functionality.
"""

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AppSettings, DailyNote, Label, NoteEntry, QuarterlyGoal, SearchHistory, SprintGoal

# Keep in sync with export version in app.routers.backup.export_data.
BACKUP_SCHEMA_VERSION = '8.0'


@pytest.mark.integration
class TestBackupExportAPI:
    """Test /api/backup/export endpoint."""

    def test_export_empty_database(self, client: TestClient):
        """Test exporting from empty database returns valid JSON structure."""
        response = client.get('/api/backup/export')

        assert response.status_code == 200
        assert response.headers['content-type'] == 'application/json'

        # Parse the JSON
        data = response.json()

        # Verify structure
        assert 'version' in data
        assert 'exported_at' in data
        assert 'notes' in data
        assert 'labels' in data
        assert 'sprint_goals' in data
        assert 'quarterly_goals' in data
        assert 'search_history' in data
        assert 'app_settings' in data

        # Empty database should have empty arrays
        assert data['notes'] == []
        assert data['labels'] == []

    def test_export_includes_version(self, client: TestClient):
        """Test that export includes version number."""
        response = client.get('/api/backup/export')

        assert response.status_code == 200
        data = response.json()
        assert data['version'] == BACKUP_SCHEMA_VERSION

    def test_export_includes_notes_and_entries(self, client: TestClient, db_session: Session):
        """Test that export includes all notes and their entries."""
        # Create test data
        note = DailyNote(date='2025-11-07', fire_rating=3, daily_goal='Test goal')
        db_session.add(note)
        db_session.commit()

        entry = NoteEntry(daily_note_id=note.id, title='Test Entry', content='<p>Test content</p>', is_important=1)
        db_session.add(entry)
        db_session.commit()

        response = client.get('/api/backup/export')

        assert response.status_code == 200
        data = response.json()

        # Verify note is included
        assert len(data['notes']) == 1
        exported_note = data['notes'][0]
        assert exported_note['date'] == '2025-11-07'
        assert exported_note['fire_rating'] == 3
        assert exported_note['daily_goal'] == 'Test goal'

        # Verify entry is included
        assert len(exported_note['entries']) == 1
        exported_entry = exported_note['entries'][0]
        assert exported_entry['title'] == 'Test Entry'
        assert exported_entry['content'] == '<p>Test content</p>'
        assert exported_entry['is_important'] is True

    def test_export_includes_labels(self, client: TestClient, db_session: Session):
        """Test that export includes all labels."""
        # Create labels
        labels = [
            Label(name='work', color='#3b82f6'),
            Label(name='personal', color='#10b981'),
        ]
        db_session.add_all(labels)
        db_session.commit()

        response = client.get('/api/backup/export')

        assert response.status_code == 200
        data = response.json()

        assert len(data['labels']) == 2
        label_names = [label['name'] for label in data['labels']]
        assert 'work' in label_names
        assert 'personal' in label_names

    def test_export_includes_entry_labels(self, client: TestClient, db_session: Session):
        """Test that export includes label associations with entries (as IDs)."""
        note = DailyNote(date='2025-11-07')
        label = Label(name='work', color='#3b82f6')
        db_session.add_all([note, label])
        db_session.commit()

        entry = NoteEntry(daily_note_id=note.id, content='<p>Work entry</p>')
        entry.labels.append(label)
        db_session.add(entry)
        db_session.commit()

        response = client.get('/api/backup/export')

        assert response.status_code == 200
        data = response.json()

        exported_entry = data['notes'][0]['entries'][0]
        assert 'labels' in exported_entry
        assert len(exported_entry['labels']) == 1
        # Labels are exported as IDs, not full objects
        assert exported_entry['labels'][0] == label.id

    def test_export_includes_goals(self, client: TestClient, db_session: Session):
        """Test that export includes sprint and quarterly goals."""
        sprint = SprintGoal(text='Sprint goal', start_date='2025-11-01', end_date='2025-11-14')
        quarterly = QuarterlyGoal(text='Q4 goal', start_date='2025-10-01', end_date='2025-12-31')
        db_session.add_all([sprint, quarterly])
        db_session.commit()

        response = client.get('/api/backup/export')

        assert response.status_code == 200
        data = response.json()

        assert len(data['sprint_goals']) == 1
        assert data['sprint_goals'][0]['text'] == 'Sprint goal'

        assert len(data['quarterly_goals']) == 1
        assert data['quarterly_goals'][0]['text'] == 'Q4 goal'

    def test_export_includes_search_history(self, client: TestClient, db_session: Session):
        """Test that export includes search history."""
        search1 = SearchHistory(query='python')
        search2 = SearchHistory(query='javascript')
        db_session.add_all([search1, search2])
        db_session.commit()

        response = client.get('/api/backup/export')

        assert response.status_code == 200
        data = response.json()

        assert len(data['search_history']) == 2
        queries = [s['query'] for s in data['search_history']]
        assert 'python' in queries
        assert 'javascript' in queries

    def test_export_includes_app_settings(self, client: TestClient, db_session: Session):
        """Test that export includes app settings."""
        settings = AppSettings(id=1, sprint_goals='Old sprint', quarterly_goals='Old quarterly')
        db_session.add(settings)
        db_session.commit()

        response = client.get('/api/backup/export')

        assert response.status_code == 200
        data = response.json()

        assert 'app_settings' in data
        assert data['app_settings']['sprint_goals'] == 'Old sprint'
        assert data['app_settings']['quarterly_goals'] == 'Old quarterly'

    def test_export_includes_timestamps(self, client: TestClient, db_session: Session):
        """Test that export includes all timestamp fields."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        entry = NoteEntry(daily_note_id=note.id, content='<p>Test</p>')
        db_session.add(entry)
        db_session.commit()

        response = client.get('/api/backup/export')

        assert response.status_code == 200
        data = response.json()

        # Verify timestamps are ISO format strings
        assert 'exported_at' in data
        exported_entry = data['notes'][0]['entries'][0]
        assert 'created_at' in exported_entry
        assert 'updated_at' in exported_entry

    def test_export_multiple_entries_per_note(self, client: TestClient, db_session: Session):
        """Test exporting note with multiple entries."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        entries = [
            NoteEntry(daily_note_id=note.id, content='<p>Entry 1</p>'),
            NoteEntry(daily_note_id=note.id, content='<p>Entry 2</p>'),
            NoteEntry(daily_note_id=note.id, content='<p>Entry 3</p>'),
        ]
        db_session.add_all(entries)
        db_session.commit()

        response = client.get('/api/backup/export')

        assert response.status_code == 200
        data = response.json()

        assert len(data['notes']) == 1
        assert len(data['notes'][0]['entries']) == 3

    def test_export_multiple_notes(self, client: TestClient, db_session: Session):
        """Test exporting multiple notes from different dates."""
        notes = [
            DailyNote(date='2025-11-01'),
            DailyNote(date='2025-11-07'),
            DailyNote(date='2025-11-15'),
        ]
        db_session.add_all(notes)
        db_session.commit()

        response = client.get('/api/backup/export')

        assert response.status_code == 200
        data = response.json()

        assert len(data['notes']) == 3
        dates = [n['date'] for n in data['notes']]
        assert '2025-11-01' in dates
        assert '2025-11-07' in dates
        assert '2025-11-15' in dates


@pytest.mark.integration
class TestBackupImportAPI:
    """Test /api/backup/import endpoint."""

    def test_import_valid_json(self, client: TestClient, db_session: Session):
        """Test importing valid backup JSON."""
        backup_data = {
            'version': '5.0',
            'exported_at': '2025-11-07T12:00:00',
            'notes': [
                {
                    'date': '2025-11-07',
                    'fire_rating': 3,
                    'daily_goal': 'Imported goal',
                    'entries': [
                        {
                            'title': 'Imported entry',
                            'content': '<p>Imported content</p>',
                            'content_type': 'rich_text',
                            'order_index': 0,
                            'is_important': True,
                            'is_completed': False,
                            'include_in_report': False,
                            'created_at': '2025-11-07T10:00:00',
                            'updated_at': '2025-11-07T10:00:00',
                            'labels': [],
                        }
                    ],
                }
            ],
            'labels': [],
            'sprint_goals': [],
            'quarterly_goals': [],
            'search_history': [],
            'app_settings': {
                'sprint_goals': '',
                'quarterly_goals': '',
                'sprint_start_date': '',
                'sprint_end_date': '',
                'quarterly_start_date': '',
                'quarterly_end_date': '',
                'created_at': '2025-11-07T12:00:00',
                'updated_at': '2025-11-07T12:00:00',
            },
        }

        # Convert to JSON string
        json_str = json.dumps(backup_data)

        # Create file-like object
        files = {'file': ('backup.json', json_str, 'application/json')}

        response = client.post('/api/backup/import', files=files)

        assert response.status_code == 200
        data = response.json()
        assert 'message' in data
        assert 'imported' in data['message'].lower()

        # Verify data was imported
        imported_note = db_session.query(DailyNote).filter(DailyNote.date == '2025-11-07').first()
        assert imported_note is not None
        assert imported_note.fire_rating == 3
        assert imported_note.daily_goal == 'Imported goal'

        assert len(imported_note.entries) == 1
        assert imported_note.entries[0].title == 'Imported entry'

    def test_import_with_labels(self, client: TestClient, db_session: Session):
        """Test importing data with labels and label associations (IDs format)."""
        backup_data = {
            'version': '5.0',
            'exported_at': '2025-11-07T12:00:00',
            'notes': [
                {
                    'date': '2025-11-07',
                    'fire_rating': 0,
                    'daily_goal': '',
                    'created_at': '2025-11-07T00:00:00',
                    'updated_at': '2025-11-07T00:00:00',
                    'labels': [],
                    'entries': [
                        {
                            'title': '',
                            'content': '<p>Work entry</p>',
                            'content_type': 'rich_text',
                            'order_index': 0,
                            'is_important': False,
                            'is_completed': False,
                            'include_in_report': False,
                            'created_at': '2025-11-07T10:00:00',
                            'updated_at': '2025-11-07T10:00:00',
                            'labels': [1],  # Label IDs, not objects
                        }
                    ],
                }
            ],
            'labels': [{'id': 1, 'name': 'work', 'color': '#3b82f6', 'created_at': '2025-11-01T00:00:00'}],
            'sprint_goals': [],
            'quarterly_goals': [],
            'search_history': [],
            'app_settings': {
                'sprint_goals': '',
                'quarterly_goals': '',
                'sprint_start_date': '',
                'sprint_end_date': '',
                'quarterly_start_date': '',
                'quarterly_end_date': '',
                'created_at': '2025-11-07T12:00:00',
                'updated_at': '2025-11-07T12:00:00',
            },
        }

        json_str = json.dumps(backup_data)
        files = {'file': ('backup.json', json_str, 'application/json')}

        response = client.post('/api/backup/import', files=files)

        assert response.status_code == 200

        # Verify label was created
        label = db_session.query(Label).filter(Label.name == 'work').first()
        assert label is not None
        assert label.color == '#3b82f6'

        # Verify entry has label
        note = db_session.query(DailyNote).first()
        entry = note.entries[0]
        assert len(entry.labels) == 1
        assert entry.labels[0].name == 'work'

    def test_import_with_goals(self, client: TestClient, db_session: Session):
        """Test importing sprint and quarterly goals."""
        backup_data = {
            'version': '5.0',
            'exported_at': '2025-11-07T12:00:00',
            'notes': [],
            'labels': [],
            'sprint_goals': [
                {
                    'id': 1,
                    'text': 'Imported sprint',
                    'start_date': '2025-11-01',
                    'end_date': '2025-11-14',
                    'created_at': '2025-11-01T00:00:00',
                    'updated_at': '2025-11-01T00:00:00',
                }
            ],
            'quarterly_goals': [
                {
                    'id': 1,
                    'text': 'Imported quarterly',
                    'start_date': '2025-10-01',
                    'end_date': '2025-12-31',
                    'created_at': '2025-10-01T00:00:00',
                    'updated_at': '2025-10-01T00:00:00',
                }
            ],
            'search_history': [],
            'app_settings': {
                'sprint_goals': '',
                'quarterly_goals': '',
                'sprint_start_date': '',
                'sprint_end_date': '',
                'quarterly_start_date': '',
                'quarterly_end_date': '',
                'created_at': '2025-11-07T12:00:00',
                'updated_at': '2025-11-07T12:00:00',
            },
        }

        json_str = json.dumps(backup_data)
        files = {'file': ('backup.json', json_str, 'application/json')}

        response = client.post('/api/backup/import', files=files)

        assert response.status_code == 200

        # Verify goals were imported
        sprint = db_session.query(SprintGoal).first()
        assert sprint is not None
        assert sprint.text == 'Imported sprint'

        quarterly = db_session.query(QuarterlyGoal).first()
        assert quarterly is not None
        assert quarterly.text == 'Imported quarterly'

    def test_import_invalid_json(self, client: TestClient):
        """Test importing invalid JSON returns error."""
        invalid_json = '{ this is not valid JSON }'
        files = {'file': ('backup.json', invalid_json, 'application/json')}

        response = client.post('/api/backup/import', files=files)

        # Should return error status
        assert response.status_code in [400, 500]

    def test_import_missing_version(self, client: TestClient):
        """Test importing JSON without version field crashes (documents production behavior)."""
        backup_data = {
            # Missing "version" field
            'notes': [],
            'labels': [],
        }

        json_str = json.dumps(backup_data)
        files = {'file': ('backup.json', json_str, 'application/json')}

        response = client.post('/api/backup/import', files=files)

        # Production returns 500 when version is missing
        assert response.status_code == 500

    def test_export_then_import_roundtrip(self, client: TestClient, db_session: Session):
        """Test that data can be exported and re-imported successfully."""
        # Create original data
        note = DailyNote(date='2025-11-07', fire_rating=5, daily_goal='Test roundtrip')
        label = Label(name='test', color='#ff0000')
        db_session.add_all([note, label])
        db_session.commit()

        entry = NoteEntry(daily_note_id=note.id, content='<p>Roundtrip test</p>', is_important=1)
        entry.labels.append(label)
        db_session.add(entry)
        db_session.commit()

        # Export
        export_response = client.get('/api/backup/export')
        assert export_response.status_code == 200
        exported_data = export_response.json()

        # Clear database
        db_session.query(NoteEntry).delete()
        db_session.query(DailyNote).delete()
        db_session.query(Label).delete()
        db_session.commit()

        # Re-import
        json_str = json.dumps(exported_data)
        files = {'file': ('backup.json', json_str, 'application/json')}
        import_response = client.post('/api/backup/import', files=files)
        assert import_response.status_code == 200

        # Verify data matches original
        restored_note = db_session.query(DailyNote).filter(DailyNote.date == '2025-11-07').first()
        assert restored_note is not None
        assert restored_note.fire_rating == 5
        assert restored_note.daily_goal == 'Test roundtrip'

        restored_entry = restored_note.entries[0]
        assert restored_entry.content == '<p>Roundtrip test</p>'
        assert restored_entry.is_important == 1
        assert len(restored_entry.labels) == 1
        assert restored_entry.labels[0].name == 'test'


@pytest.mark.integration
class TestBackupMarkdownExport:
    """Test /api/backup/export-markdown endpoint."""

    def test_export_markdown_empty_database(self, client: TestClient):
        """Test exporting markdown from empty database."""
        response = client.get('/api/backup/export-markdown')

        assert response.status_code == 200
        # Should return some markdown even if empty
        content = response.text
        assert isinstance(content, str)

    def test_export_markdown_with_entries(self, client: TestClient, db_session: Session):
        """Test that markdown export includes entry content."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        entry = NoteEntry(daily_note_id=note.id, title='Test Entry', content='<p>Test content</p>')
        db_session.add(entry)
        db_session.commit()

        response = client.get('/api/backup/export-markdown')

        assert response.status_code == 200
        markdown = response.text

        # Verify date is in markdown
        assert '2025-11-07' in markdown
        # Verify title is in markdown
        assert 'Test Entry' in markdown


@pytest.mark.integration
class TestBackupFullRestore:
    """Test /api/backup/full-restore endpoint."""

    def test_full_restore_requires_both_files(self, client: TestClient):
        """Test that full restore requires both backup_file and attachments_file."""
        # Create valid backup JSON
        backup_data = {
            'version': '5.0',
            'exported_at': '2025-11-07T12:00:00',
            'notes': [],
            'labels': [],
            'sprint_goals': [],
            'quarterly_goals': [],
            'search_history': [],
            'app_settings': {
                'sprint_goals': '',
                'quarterly_goals': '',
                'sprint_start_date': '',
                'sprint_end_date': '',
                'quarterly_start_date': '',
                'quarterly_end_date': '',
                'created_at': '2025-11-07T12:00:00',
                'updated_at': '2025-11-07T12:00:00',
            },
        }

        json_str = json.dumps(backup_data)

        # Send only backup_file without attachments_file
        files = {'backup_file': ('backup.json', json_str, 'application/json')}

        response = client.post('/api/backup/full-restore', files=files)

        # Production returns 422 when missing required file parameter
        assert response.status_code == 422
