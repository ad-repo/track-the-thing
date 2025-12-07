from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routers import reminders


def make_entry(entry_id: int = 1):
    return SimpleNamespace(
        id=entry_id,
        daily_note_id=5,
        daily_note=SimpleNamespace(date='2025-11-07'),
        title='Entry',
        content='Body',
        content_type='rich_text',
        order_index=0,
        created_at=None,
        updated_at=None,
        labels=[],
        lists=[],
        include_in_report=0,
        is_important=0,
        is_completed=0,
        is_pinned=0,
    )


def make_reminder(reminder_id: int, entry_id: int, dismissed: int):
    return SimpleNamespace(
        id=reminder_id,
        entry_id=entry_id,
        reminder_datetime='2025-11-07T09:00:00Z',
        is_dismissed=dismissed,
        created_at=None,
        updated_at=None,
        entry=make_entry(entry_id),
    )


def chainable_query(result=None):
    q = SimpleNamespace()
    q.filter = lambda *_, **__: q
    q.options = lambda *_, **__: q
    q.first = lambda: result
    return q


@pytest.mark.unit
def test_create_reminder_requires_entry():
    entry_query = chainable_query(result=None)
    db = SimpleNamespace(query=lambda *_, **__: entry_query, commit=lambda: None, refresh=lambda *_: None)

    with pytest.raises(HTTPException) as exc:
        reminders.create_reminder(
            reminders.schemas.ReminderCreate(entry_id=1, reminder_datetime='2025-11-07T09:00:00Z'),
            db=db,
        )  # type: ignore[arg-type]

    assert exc.value.status_code == 404


@pytest.mark.unit
def test_create_reminder_rejects_active_existing():
    entry_query = chainable_query(result=make_entry())
    active_query = chainable_query(result=make_reminder(1, 1, dismissed=0))

    def query_side_effect(model):
        if model.__name__ == 'NoteEntry':
            return entry_query
        return active_query

    db = SimpleNamespace(query=query_side_effect, commit=lambda: None, refresh=lambda *_: None)

    with pytest.raises(HTTPException) as exc:
        reminders.create_reminder(
            reminders.schemas.ReminderCreate(entry_id=1, reminder_datetime='2025-11-07T09:00:00Z'),
            db=db,
        )  # type: ignore[arg-type]

    assert exc.value.status_code == 400
    assert 'Active reminder already exists' in exc.value.detail


@pytest.mark.unit
def test_create_reminder_reactivates_dismissed():
    entry_query = chainable_query(result=make_entry())
    active_query = chainable_query(result=None)
    dismissed = make_reminder(2, 1, dismissed=1)
    dismissed_query = chainable_query(result=dismissed)
    reload_query = chainable_query(result=dismissed)
    commit_calls = []

    def query_side_effect(model):
        name = model.__name__
        if name == 'NoteEntry':
            return entry_query
        # First Reminder query (active), second (dismissed), third (reload)
        if not hasattr(query_side_effect, 'calls'):
            query_side_effect.calls = 0
        query_side_effect.calls += 1
        if query_side_effect.calls == 1:
            return active_query
        if query_side_effect.calls == 2:
            return dismissed_query
        return reload_query

    def commit():
        commit_calls.append(1)

    db = SimpleNamespace(query=query_side_effect, commit=commit, refresh=lambda *_: None)

    result = reminders.create_reminder(
        reminders.schemas.ReminderCreate(entry_id=1, reminder_datetime='2025-11-08T10:00:00Z'),
        db=db,  # type: ignore[arg-type]
    )

    assert result['id'] == dismissed.id
    assert dismissed.is_dismissed == 0
    assert dismissed.reminder_datetime == '2025-11-08T10:00:00Z'
    assert commit_calls, 'commit should be invoked'


@pytest.mark.unit
def test_update_reminder_toggles_dismissed():
    reminder_obj = make_reminder(3, 1, dismissed=0)
    reminder_query = chainable_query(result=reminder_obj)
    commits = []

    db = SimpleNamespace(
        query=lambda *_: reminder_query,
        commit=lambda: commits.append(1),
        refresh=lambda *_: None,
    )

    result = reminders.update_reminder(
        3,
        reminders.schemas.ReminderUpdate(is_dismissed=True, reminder_datetime=None),
        db=db,  # type: ignore[arg-type]
    )

    assert result['is_dismissed'] is True
    assert reminder_obj.is_dismissed == 1
    assert commits
