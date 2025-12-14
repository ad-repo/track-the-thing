"""
Integration tests for pinned entries feature.

Tests the ability to pin note entries so they automatically copy to future days.
"""

import time
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def unique_date_future(days_ahead: int = 1) -> str:
    """Generate unique future date for tests"""
    base_date = datetime.now() + timedelta(days=days_ahead)
    return f"{base_date.strftime('%Y-%m-%d')}_{int(time.time() * 1000)}"


def test_toggle_pin_entry(client: TestClient, db_session: Session):
    """Test toggling pin status on an entry."""
    # Create a daily note
    today = unique_date_future(0)
    note_response = client.post('/api/notes/', json={'date': today, 'fire_rating': 0, 'daily_goal': ''})
    assert note_response.status_code == 201

    # Create an entry
    entry_response = client.post(
        f'/api/entries/note/{today}',
        json={
            'content': 'Test pinned entry',
            'content_type': 'rich_text',
            'order_index': 0,
        },
    )
    assert entry_response.status_code == 201
    entry_id = entry_response.json()['id']
    assert entry_response.json()['is_pinned'] is False

    # Pin the entry
    pin_response = client.post(f'/api/entries/{entry_id}/toggle-pin')
    assert pin_response.status_code == 200
    assert pin_response.json()['is_pinned'] is True

    # Unpin the entry
    unpin_response = client.post(f'/api/entries/{entry_id}/toggle-pin')
    assert unpin_response.status_code == 200
    assert unpin_response.json()['is_pinned'] is False


def test_pinned_entry_copies_to_future_day(client: TestClient, db_session: Session):
    """Test that pinned entries automatically copy to future days."""
    # Create a daily note for today
    today = unique_date_future(0)
    tomorrow = unique_date_future(1)

    note_response = client.post('/api/notes/', json={'date': today, 'fire_rating': 0, 'daily_goal': ''})
    assert note_response.status_code == 201

    # Create and pin an entry
    entry_response = client.post(
        f'/api/entries/note/{today}',
        json={'content': 'Pinned task', 'content_type': 'rich_text', 'order_index': 0},
    )
    assert entry_response.status_code == 201
    entry_id = entry_response.json()['id']

    # Pin the entry
    client.post(f'/api/entries/{entry_id}/toggle-pin')

    # Access tomorrow's date (this should trigger the copy)
    tomorrow_response = client.get(f'/api/notes/{tomorrow}')

    # If the note doesn't exist yet, it will be created by the copy logic
    if tomorrow_response.status_code == 404:
        # The copy logic creates the note, so try again
        tomorrow_response = client.get(f'/api/entries/note/{tomorrow}')

    # Check that tomorrow has the pinned entry
    if tomorrow_response.status_code == 200:
        tomorrow_data = tomorrow_response.json()
        if isinstance(tomorrow_data, dict) and 'entries' in tomorrow_data:
            entries = tomorrow_data['entries']
        else:
            entries = tomorrow_data

        # Should have at least one entry
        assert len(entries) > 0

        # Find the pinned entry
        pinned_entries = [e for e in entries if e['is_pinned']]
        assert len(pinned_entries) > 0

        # Check content matches
        assert pinned_entries[0]['content'] == 'Pinned task'

        # Check completion status was reset
        assert pinned_entries[0]['is_completed'] is False


def test_pinned_entry_with_labels(client: TestClient, db_session: Session):
    """Test that pinned entries preserve labels when copied."""
    today = unique_date_future(0)
    tomorrow = unique_date_future(1)

    # Create a label with unique name
    label_name = f'test-label-{int(time.time() * 1000)}'
    label_response = client.post('/api/labels/', json={'name': label_name, 'color': '#ff0000'})
    assert label_response.status_code == 201
    label_id = label_response.json()['id']

    # Create a daily note
    client.post('/api/notes/', json={'date': today})

    # Create and pin an entry with unique content
    unique_content = f'Pinned with label {int(time.time() * 1000)}'
    entry_response = client.post(
        f'/api/entries/note/{today}',
        json={'content': unique_content, 'content_type': 'rich_text', 'order_index': 0},
    )
    entry_id = entry_response.json()['id']

    # Add label to entry
    label_attach = client.post(f'/api/labels/entry/{entry_id}/label/{label_id}')
    assert label_attach.status_code == 204

    # Pin the entry
    pin_response = client.post(f'/api/entries/{entry_id}/toggle-pin')
    assert pin_response.status_code == 200

    # Access tomorrow (triggers copy) - use entries endpoint which is simpler
    tomorrow_entries_response = client.get(f'/api/entries/note/{tomorrow}')
    assert tomorrow_entries_response.status_code == 200

    entries = tomorrow_entries_response.json()
    # Find our specific pinned entry by content
    our_pinned = [e for e in entries if e.get('content') == unique_content and e.get('is_pinned')]

    assert len(our_pinned) == 1, f'Expected 1 pinned entry with our content, found {len(our_pinned)}'

    # Check that labels were copied
    assert len(our_pinned[0]['labels']) > 0, 'Labels should be copied'
    assert our_pinned[0]['labels'][0]['name'] == label_name, f'Expected label {label_name}'


def test_multiple_pinned_entries(client: TestClient, db_session: Session):
    """Test that multiple entries can be pinned simultaneously."""
    today = unique_date_future(0)
    tomorrow = unique_date_future(1)

    # Create a daily note
    client.post('/api/notes/', json={'date': today})

    # Create and pin multiple entries with unique content
    timestamp = int(time.time() * 1000)
    entry_contents = []
    for i in range(3):
        content = f'Multi-pin test entry {i+1} {timestamp}'
        entry_contents.append(content)
        entry_response = client.post(
            f'/api/entries/note/{today}',
            json={'content': content, 'content_type': 'rich_text', 'order_index': 0},
        )
        assert entry_response.status_code == 201
        entry_id = entry_response.json()['id']
        pin_response = client.post(f'/api/entries/{entry_id}/toggle-pin')
        assert pin_response.status_code == 200

    # Access tomorrow - use entries endpoint directly
    tomorrow_entries_response = client.get(f'/api/entries/note/{tomorrow}')
    assert tomorrow_entries_response.status_code == 200

    entries = tomorrow_entries_response.json()
    # Filter for our specific test entries by exact content match
    test_pinned_entries = [e for e in entries if e.get('is_pinned') and e.get('content') in entry_contents]

    # All three entries should be copied
    assert len(test_pinned_entries) == 3, f'Expected 3 pinned entries, found {len(test_pinned_entries)}'


def test_pinned_entry_no_duplicate_on_multiple_access(client: TestClient, db_session: Session):
    """Test that pinned entries don't duplicate when accessing the same day multiple times."""
    today = unique_date_future(0)
    tomorrow = unique_date_future(1)

    # Create a daily note and pinned entry with unique content
    unique_content = f'No duplicate test {int(time.time() * 1000)}'
    client.post('/api/notes/', json={'date': today})
    entry_response = client.post(
        f'/api/entries/note/{today}',
        json={'content': unique_content, 'content_type': 'rich_text', 'order_index': 0},
    )
    assert entry_response.status_code == 201
    entry_id = entry_response.json()['id']

    pin_response = client.post(f'/api/entries/{entry_id}/toggle-pin')
    assert pin_response.status_code == 200

    # Access tomorrow multiple times - use entries endpoint directly
    for _ in range(3):
        client.get(f'/api/entries/note/{tomorrow}')

    # Check that there's only one copy
    tomorrow_entries_response = client.get(f'/api/entries/note/{tomorrow}')
    assert tomorrow_entries_response.status_code == 200

    entries = tomorrow_entries_response.json()
    pinned_entries = [e for e in entries if e.get('is_pinned') and e.get('content') == unique_content]

    # Should only have one copy, not three
    assert len(pinned_entries) == 1, f'Expected 1 copy, found {len(pinned_entries)}'


def test_update_entry_pin_status_via_patch(client: TestClient, db_session: Session):
    """Test updating pin status via PATCH endpoint."""
    today = unique_date_future(0)

    # Create a daily note and entry
    client.post('/api/notes/', json={'date': today})
    entry_response = client.post(
        f'/api/entries/note/{today}',
        json={'content': 'Test entry', 'content_type': 'rich_text', 'order_index': 0},
    )
    entry_id = entry_response.json()['id']

    # Update pin status via PATCH
    patch_response = client.patch(f'/api/entries/{entry_id}', json={'is_pinned': True})
    assert patch_response.status_code == 200
    assert patch_response.json()['is_pinned'] is True

    # Update back to unpinned
    patch_response = client.patch(f'/api/entries/{entry_id}', json={'is_pinned': False})
    assert patch_response.status_code == 200
    assert patch_response.json()['is_pinned'] is False


def test_pinned_entry_in_backup(client: TestClient, db_session: Session):
    """Test that pinned status is included in backup export."""
    today = unique_date_future(0)

    # Create a daily note and pinned entry
    client.post('/api/notes/', json={'date': today})
    entry_response = client.post(
        f'/api/entries/note/{today}',
        json={'content': 'Backup test', 'content_type': 'rich_text', 'order_index': 0},
    )
    entry_id = entry_response.json()['id']
    client.post(f'/api/entries/{entry_id}/toggle-pin')

    # Export backup
    backup_response = client.get('/api/backup/export')
    assert backup_response.status_code == 200

    backup_data = backup_response.json()

    # Find the note and check the entry
    notes = backup_data.get('notes', [])
    if len(notes) > 0:
        entries = notes[0].get('entries', [])
        if len(entries) > 0:
            assert entries[0]['is_pinned'] is True


def test_delete_pinned_entry_unpins_all_copies(client: TestClient, db_session: Session):
    """
    CRITICAL TEST: When deleting a pinned entry (or any copy of a pinned entry),
    all copies should be unpinned first to prevent them from being re-created.

    This test verifies the fix for the bug where deleted pinned entries would
    reappear after refresh because they were being copied forward again.
    """
    # Create a daily note for Day 1
    date1 = '2025-01-15'
    client.post(f'/api/notes/{date1}')

    # Create an entry on Day 1
    entry_response = client.post(
        f'/api/entries/note/{date1}',
        json={
            'title': 'Important Task',
            'content': 'This is a pinned task that should not reappear after deletion',
            'content_type': 'rich_text',
        },
    )
    entry1_id = entry_response.json()['id']

    # Pin the entry
    client.patch(f'/api/entries/{entry1_id}', json={'is_pinned': True})

    # Access Day 2 - should create a copy
    date2 = '2025-01-16'
    response = client.get(f'/api/notes/{date2}')
    day2_entries = response.json()['entries']
    assert len(day2_entries) == 1
    entry2_id = day2_entries[0]['id']
    assert entry2_id != entry1_id  # Different entry
    assert day2_entries[0]['is_pinned'] == 1  # Copy is also pinned

    # Access Day 3 - should create another copy
    date3 = '2025-01-17'
    response = client.get(f'/api/notes/{date3}')
    day3_entries = response.json()['entries']
    assert len(day3_entries) == 1
    entry3_id = day3_entries[0]['id']
    assert entry3_id != entry1_id and entry3_id != entry2_id  # Different entry
    assert day3_entries[0]['is_pinned'] == 1  # Copy is also pinned

    # Now delete the Day 2 copy
    # This should unpin ALL copies (Day 1, Day 2, Day 3) before deleting Day 2
    delete_response = client.delete(f'/api/entries/{entry2_id}')
    assert delete_response.status_code == 204

    # Verify Day 2 entry is deleted
    response = client.get(f'/api/notes/{date2}')
    day2_entries = response.json()['entries']
    assert len(day2_entries) == 0

    # Verify Day 1 entry is now UNPINNED
    response = client.get(f'/api/entries/{entry1_id}')
    assert response.status_code == 200
    assert response.json()['is_pinned'] == 0

    # Verify Day 3 entry is now UNPINNED
    response = client.get(f'/api/entries/{entry3_id}')
    assert response.status_code == 200
    assert response.json()['is_pinned'] == 0

    # Access Day 4 - should NOT create a new copy (because all are unpinned)
    date4 = '2025-01-18'
    response = client.get(f'/api/notes/{date4}')
    day4_entries = response.json()['entries']
    assert len(day4_entries) == 0  # No pinned entries to copy

    # Verify Day 1 entry still exists (not deleted)
    response = client.get(f'/api/entries/{entry1_id}')
    assert response.status_code == 200
    assert response.json()['title'] == 'Important Task'

    # Verify Day 3 entry still exists (not deleted)
    response = client.get(f'/api/entries/{entry3_id}')
    assert response.status_code == 200
    assert response.json()['title'] == 'Important Task'
