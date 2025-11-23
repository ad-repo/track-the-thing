"""
Integration tests for /api/reminders endpoints.
"""

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import models


def iso_minutes_from_now(minutes: int) -> str:
    """Helper to generate ISO timestamps relative to now."""
    return (datetime.utcnow() + timedelta(minutes=minutes)).isoformat()


@pytest.mark.integration
class TestRemindersAPI:
    """Exercise reminder CRUD, filters, and due logic."""

    def test_create_reminder_success(self, client: TestClient, sample_note_entry: models.NoteEntry):
        """POST should create reminder for entry."""
        payload = {
            'entry_id': sample_note_entry.id,
            'reminder_datetime': iso_minutes_from_now(10),
        }

        response = client.post('/api/reminders', json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data['entry_id'] == sample_note_entry.id
        assert data['reminder_datetime'].startswith(payload['reminder_datetime'][:16])

    def test_create_reminder_blocks_duplicate_active(self, client: TestClient, sample_note_entry: models.NoteEntry):
        """Second reminder for same entry should fail until dismissed."""
        payload = {
            'entry_id': sample_note_entry.id,
            'reminder_datetime': iso_minutes_from_now(5),
        }
        assert client.post('/api/reminders', json=payload).status_code == 200

        duplicate_response = client.post('/api/reminders', json=payload)
        assert duplicate_response.status_code == 400

    def test_get_reminders_filters_dismissed(
        self,
        client: TestClient,
        db_session: Session,
        sample_note_entry: models.NoteEntry,
    ):
        """GET without include_dismissed should hide dismissed reminders."""
        active = models.Reminder(
            entry_id=sample_note_entry.id,
            reminder_datetime='2025-11-07T09:00:00Z',
            is_dismissed=0,
        )
        dismissed = models.Reminder(
            entry_id=sample_note_entry.id,
            reminder_datetime='2025-11-07T10:00:00Z',
            is_dismissed=1,
        )
        db_session.add_all([active, dismissed])
        db_session.commit()

        response = client.get('/api/reminders')
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

        all_response = client.get('/api/reminders', params={'include_dismissed': 'true'})
        assert len(all_response.json()) == 2

    def test_get_due_reminders_only_returns_past_due(
        self,
        client: TestClient,
        db_session: Session,
        sample_note_entry: models.NoteEntry,
    ):
        """GET /api/reminders/due should return non-dismissed reminders with datetime <= now."""
        due = models.Reminder(
            entry_id=sample_note_entry.id,
            reminder_datetime=iso_minutes_from_now(-1),
            is_dismissed=0,
        )
        future = models.Reminder(
            entry_id=sample_note_entry.id,
            reminder_datetime=iso_minutes_from_now(60),
            is_dismissed=0,
        )
        dismissed = models.Reminder(
            entry_id=sample_note_entry.id,
            reminder_datetime=iso_minutes_from_now(-5),
            is_dismissed=1,
        )
        db_session.add_all([due, future, dismissed])
        db_session.commit()

        response = client.get('/api/reminders/due')
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]['reminder_datetime'].startswith(due.reminder_datetime[:16])

    def test_update_reminder_can_dismiss(
        self,
        client: TestClient,
        db_session: Session,
        sample_note_entry: models.NoteEntry,
    ):
        """PATCH should allow dismissing reminders."""
        reminder = models.Reminder(
            entry_id=sample_note_entry.id,
            reminder_datetime='2025-11-07T09:00:00Z',
            is_dismissed=0,
        )
        db_session.add(reminder)
        db_session.commit()

        response = client.patch(f'/api/reminders/{reminder.id}', json={'is_dismissed': True})
        assert response.status_code == 200
        assert response.json()['is_dismissed'] is True

    def test_delete_reminder(
        self,
        client: TestClient,
        db_session: Session,
        sample_note_entry: models.NoteEntry,
    ):
        """DELETE should remove reminder."""
        reminder = models.Reminder(
            entry_id=sample_note_entry.id,
            reminder_datetime='2025-11-07T12:00:00Z',
            is_dismissed=0,
        )
        db_session.add(reminder)
        db_session.commit()

        response = client.delete(f'/api/reminders/{reminder.id}')
        assert response.status_code == 200
        assert response.json()['id'] == reminder.id
        assert db_session.query(models.Reminder).count() == 0

    def test_get_reminder_for_entry_returns_none_after_dismiss(
        self,
        client: TestClient,
        db_session: Session,
        sample_note_entry: models.NoteEntry,
    ):
        """Entry endpoint should return None when reminder dismissed."""
        reminder = models.Reminder(
            entry_id=sample_note_entry.id,
            reminder_datetime='2025-11-07T15:00:00Z',
            is_dismissed=1,
        )
        db_session.add(reminder)
        db_session.commit()

        response = client.get(f'/api/reminders/entry/{sample_note_entry.id}')
        assert response.status_code == 200
        assert response.json() is None
