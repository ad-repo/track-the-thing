"""
Unit tests for Note Entry models and business logic.
"""

from datetime import datetime

import pytest
from sqlalchemy.orm import Session

from app.models import DailyNote, Label, NoteEntry


@pytest.mark.unit
class TestNoteEntryModel:
    """Test NoteEntry model operations."""

    def test_create_entry_with_all_fields(self, db_session: Session, sample_daily_note: DailyNote):
        """Test creating an entry with all fields populated."""
        entry = NoteEntry(
            daily_note_id=sample_daily_note.id,
            title='Complete Entry',
            content='<p>Full content with <strong>formatting</strong></p>',
            content_type='rich_text',
            order_index=5,
            is_important=1,
            is_completed=1,
            include_in_report=1,
        )
        db_session.add(entry)
        db_session.commit()
        db_session.refresh(entry)

        assert entry.id is not None
        assert entry.title == 'Complete Entry'
        assert entry.is_important == 1
        assert entry.is_completed == 1
        assert entry.created_at is not None
        assert entry.updated_at is not None

    def test_create_entry_minimal_fields(self, db_session: Session, sample_daily_note: DailyNote):
        """Test creating an entry with only required fields."""
        entry = NoteEntry(daily_note_id=sample_daily_note.id, content='<p>Minimal content</p>')
        db_session.add(entry)
        db_session.commit()
        db_session.refresh(entry)

        assert entry.id is not None
        assert entry.title == ''  # Default empty string
        assert entry.content_type == 'rich_text'  # Default
        assert entry.is_important == 0  # Default
        assert entry.is_completed == 0  # Default
        assert entry.include_in_report == 0  # Default

    def test_entry_timestamps_auto_generated(self, db_session: Session, sample_daily_note: DailyNote):
        """Test that created_at and updated_at are auto-generated."""
        entry = NoteEntry(daily_note_id=sample_daily_note.id, content='<p>Test timestamp</p>')
        db_session.add(entry)
        db_session.commit()
        db_session.refresh(entry)

        assert entry.created_at is not None
        assert entry.updated_at is not None
        assert isinstance(entry.created_at, datetime)
        assert isinstance(entry.updated_at, datetime)

    def test_entry_relationship_with_daily_note(self, db_session: Session, sample_daily_note: DailyNote):
        """Test relationship between entry and daily note."""
        entry = NoteEntry(daily_note_id=sample_daily_note.id, content='<p>Relationship test</p>')
        db_session.add(entry)
        db_session.commit()
        db_session.refresh(entry)

        assert entry.daily_note is not None
        assert entry.daily_note.id == sample_daily_note.id
        assert entry in sample_daily_note.entries

    def test_entry_with_labels(self, db_session: Session, sample_daily_note: DailyNote, sample_label: Label):
        """Test attaching labels to an entry."""
        entry = NoteEntry(daily_note_id=sample_daily_note.id, content='<p>Entry with labels</p>')
        entry.labels.append(sample_label)
        db_session.add(entry)
        db_session.commit()
        db_session.refresh(entry)

        assert len(entry.labels) == 1
        assert entry.labels[0].name == sample_label.name

    def test_entry_with_multiple_labels(
        self,
        db_session: Session,
        sample_daily_note: DailyNote,
        sample_label: Label,
        sample_emoji_label: Label,
    ):
        """Test attaching multiple labels to an entry."""
        entry = NoteEntry(daily_note_id=sample_daily_note.id, content='<p>Multiple labels</p>')
        entry.labels.extend([sample_label, sample_emoji_label])
        db_session.add(entry)
        db_session.commit()
        db_session.refresh(entry)

        assert len(entry.labels) == 2
        label_names = [label.name for label in entry.labels]
        assert sample_label.name in label_names
        assert sample_emoji_label.name in label_names

    def test_entry_state_flags(self, db_session: Session, sample_daily_note: DailyNote):
        """Test all entry state flags."""
        # Test is_important
        entry1 = NoteEntry(
            daily_note_id=sample_daily_note.id,
            content='<p>Important entry</p>',
            is_important=1,
        )
        db_session.add(entry1)

        # Test is_completed
        entry2 = NoteEntry(
            daily_note_id=sample_daily_note.id,
            content='<p>Completed entry</p>',
            is_completed=1,
        )
        db_session.add(entry2)

        # Test include_in_report
        entry4 = NoteEntry(
            daily_note_id=sample_daily_note.id,
            content='<p>Report entry</p>',
            include_in_report=1,
        )
        db_session.add(entry4)

        db_session.commit()

        assert entry1.is_important == 1
        assert entry2.is_completed == 1
        assert entry4.include_in_report == 1

    def test_entry_ordering(self, db_session: Session, sample_daily_note: DailyNote):
        """Test order_index for sorting entries."""
        entry1 = NoteEntry(daily_note_id=sample_daily_note.id, content='<p>First</p>', order_index=0)
        entry2 = NoteEntry(daily_note_id=sample_daily_note.id, content='<p>Second</p>', order_index=1)
        entry3 = NoteEntry(daily_note_id=sample_daily_note.id, content='<p>Third</p>', order_index=2)

        db_session.add_all([entry3, entry1, entry2])  # Add out of order
        db_session.commit()

        # Query entries ordered by order_index
        entries = (
            db_session.query(NoteEntry)
            .filter(NoteEntry.daily_note_id == sample_daily_note.id)
            .order_by(NoteEntry.order_index.asc())
            .all()
        )

        assert len(entries) >= 3
        assert entries[0].content == '<p>First</p>'
        assert entries[1].content == '<p>Second</p>'
        assert entries[2].content == '<p>Third</p>'

    def test_empty_content_handling(self, db_session: Session, sample_daily_note: DailyNote):
        """Test handling of empty content (should be allowed)."""
        entry = NoteEntry(daily_note_id=sample_daily_note.id, content='')
        db_session.add(entry)
        db_session.commit()
        db_session.refresh(entry)

        assert entry.content == ''
        assert entry.id is not None

    def test_rich_text_content_types(self, db_session: Session, sample_daily_note: DailyNote):
        """Test different content types."""
        entry_rich = NoteEntry(
            daily_note_id=sample_daily_note.id,
            content='<p>Rich text</p>',
            content_type='rich_text',
        )
        entry_code = NoteEntry(
            daily_note_id=sample_daily_note.id,
            content='def hello(): pass',
            content_type='code',
        )
        entry_markdown = NoteEntry(
            daily_note_id=sample_daily_note.id,
            content='# Markdown',
            content_type='markdown',
        )

        db_session.add_all([entry_rich, entry_code, entry_markdown])
        db_session.commit()

        assert entry_rich.content_type == 'rich_text'
        assert entry_code.content_type == 'code'
        assert entry_markdown.content_type == 'markdown'

    def test_delete_entry_removes_label_associations(
        self, db_session: Session, sample_daily_note: DailyNote, sample_label: Label
    ):
        """Test that deleting an entry removes its label associations."""
        entry = NoteEntry(daily_note_id=sample_daily_note.id, content='<p>Will be deleted</p>')
        entry.labels.append(sample_label)
        db_session.add(entry)
        db_session.commit()
        entry_id = entry.id

        # Delete entry
        db_session.delete(entry)
        db_session.commit()

        # Verify entry is deleted
        deleted_entry = db_session.query(NoteEntry).filter(NoteEntry.id == entry_id).first()
        assert deleted_entry is None

        # Verify label still exists
        label_exists = db_session.query(Label).filter(Label.id == sample_label.id).first()
        assert label_exists is not None
