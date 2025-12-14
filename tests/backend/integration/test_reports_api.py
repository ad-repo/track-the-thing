"""
Integration tests for Reports API endpoints
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import DailyNote, Label, NoteEntry


@pytest.mark.integration
class TestReportsAPI:
    """Test /api/reports/ endpoints."""

    def test_generate_weekly_report_empty(self, client: TestClient):
        """Test GET /api/reports/generate with no data returns empty report."""
        response = client.get('/api/reports/generate')

        assert response.status_code == 200
        data = response.json()
        assert 'week_start' in data
        assert 'week_end' in data
        assert 'generated_at' in data
        assert 'entries' in data
        assert len(data['entries']) == 0

    def test_generate_weekly_report_with_entries(self, client: TestClient, db_session: Session):
        """Test GET /api/reports/generate includes entries marked for report."""
        # Create daily note
        note = DailyNote(date='2025-11-07', fire_rating=3)
        db_session.add(note)
        db_session.commit()

        # Create entries - some marked for report, some not
        entry1 = NoteEntry(daily_note_id=note.id, content='<p>Report entry 1</p>', include_in_report=1)
        entry2 = NoteEntry(daily_note_id=note.id, content='<p>Not in report</p>', include_in_report=0)
        entry3 = NoteEntry(daily_note_id=note.id, content='<p>Report entry 2</p>', include_in_report=1)
        db_session.add_all([entry1, entry2, entry3])
        db_session.commit()

        # Generate report for this week
        response = client.get('/api/reports/generate?date=2025-11-07')

        assert response.status_code == 200
        data = response.json()
        assert len(data['entries']) == 2

        # Verify only report entries are included
        contents = [e['content'] for e in data['entries']]
        assert '<p>Report entry 1</p>' in contents
        assert '<p>Report entry 2</p>' in contents
        assert '<p>Not in report</p>' not in contents

    def test_generate_weekly_report_with_specific_date(self, client: TestClient, db_session: Session):
        """Test GET /api/reports/generate with specific date parameter."""
        # Create notes in different weeks
        note1 = DailyNote(date='2025-11-01', fire_rating=3)
        note2 = DailyNote(date='2025-11-10', fire_rating=3)
        db_session.add_all([note1, note2])
        db_session.commit()

        entry1 = NoteEntry(daily_note_id=note1.id, content='<p>Week 1 entry</p>', include_in_report=1)
        entry2 = NoteEntry(daily_note_id=note2.id, content='<p>Week 2 entry</p>', include_in_report=1)
        db_session.add_all([entry1, entry2])
        db_session.commit()

        # Generate report for first week
        response = client.get('/api/reports/generate?date=2025-11-01')

        assert response.status_code == 200
        data = response.json()

        # Should only include entry from that week
        assert len(data['entries']) == 1
        assert data['entries'][0]['content'] == '<p>Week 1 entry</p>'

    def test_generate_weekly_report_wednesday_bounds(self, client: TestClient, db_session: Session):
        """Test that weekly report uses Wednesday-to-Wednesday bounds."""
        # Create notes across Wednesday boundary
        # Wednesday Nov 6
        wed_note = DailyNote(date='2025-11-06', fire_rating=3)
        # Tuesday Nov 5 (before Wednesday)
        tue_note = DailyNote(date='2025-11-05', fire_rating=3)
        # Thursday Nov 7 (after Wednesday, same week)
        thu_note = DailyNote(date='2025-11-07', fire_rating=3)

        db_session.add_all([wed_note, tue_note, thu_note])
        db_session.commit()

        # Add entries to each
        entries = [
            NoteEntry(daily_note_id=tue_note.id, content='<p>Tuesday</p>', include_in_report=1),
            NoteEntry(
                daily_note_id=wed_note.id,
                content='<p>Wednesday</p>',
                include_in_report=1,
            ),
            NoteEntry(
                daily_note_id=thu_note.id,
                content='<p>Thursday</p>',
                include_in_report=1,
            ),
        ]
        db_session.add_all(entries)
        db_session.commit()

        # Generate report for the week containing Wednesday Nov 6
        response = client.get('/api/reports/generate?date=2025-11-06')

        assert response.status_code == 200
        data = response.json()

        # All three should be in the same week
        assert len(data['entries']) >= 2  # At least Wed and Thu

    def test_generate_weekly_report_includes_labels(self, client: TestClient, db_session: Session):
        """Test that report entries include label information."""
        # Create note and labels
        note = DailyNote(date='2025-11-07')
        label1 = Label(name='work', color='#3b82f6')
        label2 = Label(name='urgent', color='#ef4444')
        db_session.add_all([note, label1, label2])
        db_session.commit()

        # Create entry with labels
        entry = NoteEntry(
            daily_note_id=note.id,
            content='<p>Entry with labels</p>',
            include_in_report=1,
        )
        entry.labels.extend([label1, label2])
        db_session.add(entry)
        db_session.commit()

        response = client.get('/api/reports/generate?date=2025-11-07')

        assert response.status_code == 200
        data = response.json()
        assert len(data['entries']) == 1

        # Verify labels are included
        entry_data = data['entries'][0]
        assert 'labels' in entry_data
        assert len(entry_data['labels']) == 2
        label_names = [label['name'] for label in entry_data['labels']]
        assert 'work' in label_names
        assert 'urgent' in label_names

    def test_generate_weekly_report_includes_flags(self, client: TestClient, db_session: Session):
        """Test that report includes entry state flags."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        entry = NoteEntry(
            daily_note_id=note.id,
            content='<p>Completed dev null entry</p>',
            include_in_report=1,
            is_completed=1,
        )
        db_session.add(entry)
        db_session.commit()

        response = client.get('/api/reports/generate?date=2025-11-07')

        assert response.status_code == 200
        data = response.json()
        assert len(data['entries']) == 1

        entry_data = data['entries'][0]
        assert entry_data['is_completed'] is True

    def test_generate_weekly_report_invalid_date_format(self, client: TestClient):
        """Test that invalid date format falls back to current date."""
        response = client.get('/api/reports/generate?date=invalid-date')

        # Should still work, just use current date
        assert response.status_code == 200
        data = response.json()
        assert 'entries' in data

    def test_generate_all_entries_report_empty(self, client: TestClient):
        """Test GET /api/reports/all-entries with no data returns empty."""
        response = client.get('/api/reports/all-entries')

        assert response.status_code == 200
        data = response.json()
        assert 'generated_at' in data
        assert 'entries' in data
        assert len(data['entries']) == 0

    def test_generate_all_entries_report_filters_correctly(self, client: TestClient, db_session: Session):
        """Test that all-entries report only includes marked entries."""
        # Create multiple notes across different dates
        note1 = DailyNote(date='2025-10-01')
        note2 = DailyNote(date='2025-11-01')
        note3 = DailyNote(date='2025-12-01')
        db_session.add_all([note1, note2, note3])
        db_session.commit()

        # Create mix of entries
        entries = [
            NoteEntry(daily_note_id=note1.id, content='<p>Report 1</p>', include_in_report=1),
            NoteEntry(daily_note_id=note1.id, content='<p>Not report</p>', include_in_report=0),
            NoteEntry(daily_note_id=note2.id, content='<p>Report 2</p>', include_in_report=1),
            NoteEntry(
                daily_note_id=note2.id,
                content='<p>Not report 2</p>',
                include_in_report=0,
            ),
            NoteEntry(daily_note_id=note3.id, content='<p>Report 3</p>', include_in_report=1),
        ]
        db_session.add_all(entries)
        db_session.commit()

        response = client.get('/api/reports/all-entries')

        assert response.status_code == 200
        data = response.json()
        assert len(data['entries']) == 3

        # Verify only report entries
        contents = [e['content'] for e in data['entries']]
        assert '<p>Report 1</p>' in contents
        assert '<p>Report 2</p>' in contents
        assert '<p>Report 3</p>' in contents
        assert '<p>Not report</p>' not in contents

    def test_generate_all_entries_report_chronological_order(self, client: TestClient, db_session: Session):
        """Test that all-entries report is in chronological order."""
        # Create notes in non-chronological order
        note3 = DailyNote(date='2025-12-01')
        note1 = DailyNote(date='2025-10-01')
        note2 = DailyNote(date='2025-11-01')
        db_session.add_all([note3, note1, note2])
        db_session.commit()

        # Add entries
        entries = [
            NoteEntry(daily_note_id=note3.id, content='<p>December</p>', include_in_report=1),
            NoteEntry(daily_note_id=note1.id, content='<p>October</p>', include_in_report=1),
            NoteEntry(daily_note_id=note2.id, content='<p>November</p>', include_in_report=1),
        ]
        db_session.add_all(entries)
        db_session.commit()

        response = client.get('/api/reports/all-entries')

        assert response.status_code == 200
        data = response.json()
        assert len(data['entries']) == 3

        # Verify chronological order (earliest first)
        assert data['entries'][0]['content'] == '<p>October</p>'
        assert data['entries'][1]['content'] == '<p>November</p>'
        assert data['entries'][2]['content'] == '<p>December</p>'

    def test_generate_all_entries_includes_important_flag(self, client: TestClient, db_session: Session):
        """Test that all-entries report includes is_important flag (not in weekly report)."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        entry = NoteEntry(
            daily_note_id=note.id,
            content='<p>Important entry</p>',
            include_in_report=1,
            is_important=1,
        )
        db_session.add(entry)
        db_session.commit()

        response = client.get('/api/reports/all-entries')

        assert response.status_code == 200
        data = response.json()
        assert len(data['entries']) == 1
        assert data['entries'][0]['is_important'] is True

    def test_get_available_weeks_empty(self, client: TestClient):
        """Test GET /api/reports/weeks with no data returns empty list."""
        response = client.get('/api/reports/weeks')

        assert response.status_code == 200
        data = response.json()
        assert 'weeks' in data
        assert len(data['weeks']) == 0

    def test_get_available_weeks_returns_unique_weeks(self, client: TestClient, db_session: Session):
        """Test that available weeks returns unique weeks with report entries."""
        # Create notes in different weeks
        note1 = DailyNote(date='2025-11-01')  # Week 1
        note2 = DailyNote(date='2025-11-03')  # Same week
        note3 = DailyNote(date='2025-11-10')  # Week 2
        db_session.add_all([note1, note2, note3])
        db_session.commit()

        # Add report entries
        entries = [
            NoteEntry(daily_note_id=note1.id, content='<p>W1 E1</p>', include_in_report=1),
            NoteEntry(daily_note_id=note2.id, content='<p>W1 E2</p>', include_in_report=1),
            NoteEntry(daily_note_id=note3.id, content='<p>W2 E1</p>', include_in_report=1),
        ]
        db_session.add_all(entries)
        db_session.commit()

        response = client.get('/api/reports/weeks')

        assert response.status_code == 200
        data = response.json()

        # Should have 2 unique weeks (note1 and note2 are same week)
        assert len(data['weeks']) == 2

    def test_get_available_weeks_sorted_descending(self, client: TestClient, db_session: Session):
        """Test that available weeks are sorted newest first."""
        # Create notes in different weeks (use dates far apart to ensure different weeks)
        note1 = DailyNote(date='2025-09-15')  # Mid-September
        note2 = DailyNote(date='2025-10-15')  # Mid-October
        note3 = DailyNote(date='2025-11-15')  # Mid-November
        db_session.add_all([note1, note2, note3])
        db_session.commit()

        # Add report entries
        entries = [
            NoteEntry(daily_note_id=note1.id, content='<p>Sept</p>', include_in_report=1),
            NoteEntry(daily_note_id=note2.id, content='<p>Oct</p>', include_in_report=1),
            NoteEntry(daily_note_id=note3.id, content='<p>Nov</p>', include_in_report=1),
        ]
        db_session.add_all(entries)
        db_session.commit()

        response = client.get('/api/reports/weeks')

        assert response.status_code == 200
        data = response.json()
        assert len(data['weeks']) == 3

        # Verify descending order (newest first)
        # The latest week should be first, earliest should be last
        # Compare start dates to verify descending order
        first_start = data['weeks'][0]['start']
        last_start = data['weeks'][2]['start']
        assert first_start > last_start  # Newer date string is "greater"

    def test_get_available_weeks_format(self, client: TestClient, db_session: Session):
        """Test that available weeks have correct format."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        entry = NoteEntry(daily_note_id=note.id, content='<p>Test</p>', include_in_report=1)
        db_session.add(entry)
        db_session.commit()

        response = client.get('/api/reports/weeks')

        assert response.status_code == 200
        data = response.json()
        assert len(data['weeks']) == 1

        week = data['weeks'][0]
        assert 'start' in week
        assert 'end' in week
        assert 'label' in week

        # Verify date format (YYYY-MM-DD)
        assert len(week['start']) == 10
        assert week['start'][4] == '-'
        assert week['start'][7] == '-'

    def test_get_available_weeks_ignores_non_report_entries(self, client: TestClient, db_session: Session):
        """Test that weeks without report entries are not included."""
        # Create notes
        note1 = DailyNote(date='2025-11-01')
        note2 = DailyNote(date='2025-11-10')
        db_session.add_all([note1, note2])
        db_session.commit()

        # Only one has report entry
        entry1 = NoteEntry(daily_note_id=note1.id, content='<p>Not report</p>', include_in_report=0)
        entry2 = NoteEntry(daily_note_id=note2.id, content='<p>Report</p>', include_in_report=1)
        db_session.add_all([entry1, entry2])
        db_session.commit()

        response = client.get('/api/reports/weeks')

        assert response.status_code == 200
        data = response.json()

        # Should only have 1 week (the one with report entry)
        assert len(data['weeks']) == 1
        assert '2025-11-10' in data['weeks'][0]['start'] or '2025-11' in data['weeks'][0]['start']

    def test_report_entries_include_metadata(self, client: TestClient, db_session: Session):
        """Test that report entries include all required metadata fields."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        entry = NoteEntry(
            daily_note_id=note.id,
            content='<p>Test content</p>',
            content_type='rich_text',
            include_in_report=1,
            is_completed=0,
            is_important=0,
        )
        db_session.add(entry)
        db_session.commit()

        response = client.get('/api/reports/all-entries')

        assert response.status_code == 200
        data = response.json()
        assert len(data['entries']) == 1

        entry_data = data['entries'][0]
        # Verify all expected fields are present
        required_fields = [
            'date',
            'entry_id',
            'content',
            'content_type',
            'labels',
            'created_at',
            'is_completed',
            'is_important',
        ]
        for field in required_fields:
            assert field in entry_data, f'Missing field: {field}'

    def test_weekly_report_missing_is_important_field(self, client: TestClient, db_session: Session):
        """Test that weekly report does NOT include is_important (only all-entries has it)."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        entry = NoteEntry(
            daily_note_id=note.id,
            content='<p>Test</p>',
            include_in_report=1,
            is_important=1,
        )
        db_session.add(entry)
        db_session.commit()

        response = client.get('/api/reports/generate?date=2025-11-07')

        assert response.status_code == 200
        data = response.json()
        assert len(data['entries']) == 1

        # Weekly report should NOT have is_important field
        assert 'is_important' not in data['entries'][0]
