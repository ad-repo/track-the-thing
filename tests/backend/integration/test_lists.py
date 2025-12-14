"""
Integration tests for Lists API endpoints
"""

import random
import time

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def unique_name(prefix: str) -> str:
    """Generate unique name for tests"""
    return f'{prefix}_{int(time.time() * 1000)}_{random.randint(1000, 9999)}'


def unique_date() -> str:
    """Generate unique date for tests"""
    return f'2025-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}_{int(time.time() * 1000)}'


def test_create_list(client: TestClient, db_session: Session):
    """Test creating a new list"""
    name = unique_name('Test List')
    response = client.post(
        '/api/lists',
        json={
            'name': name,
            'description': 'A test list',
            'color': '#ff0000',
            'order_index': 0,
        },
    )
    assert response.status_code == 200, f'Failed: {response.text}'
    data = response.json()
    assert data['name'] == name
    assert data['description'] == 'A test list'
    assert data['color'] == '#ff0000'
    assert 'id' in data


def test_create_duplicate_list(client: TestClient, db_session: Session):
    """Test that creating a list with duplicate name fails"""
    name = unique_name('Duplicate List')
    client.post(
        '/api/lists',
        json={'name': name, 'description': '', 'color': '#3b82f6'},
    )
    response = client.post(
        '/api/lists',
        json={'name': name, 'description': '', 'color': '#3b82f6'},
    )
    assert response.status_code == 400
    assert 'already exists' in response.json()['detail']


def test_get_all_lists(client: TestClient, db_session: Session):
    """Test getting all lists"""
    name1 = unique_name('List 1')
    name2 = unique_name('List 2')
    client.post('/api/lists', json={'name': name1, 'color': '#ff0000'})
    client.post('/api/lists', json={'name': name2, 'color': '#00ff00'})

    response = client.get('/api/lists')
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


def test_get_list_by_id(client: TestClient, db_session: Session):
    """Test getting a single list with entries"""
    # Create list
    name = unique_name('Test List')
    create_response = client.post(
        '/api/lists',
        json={'name': name, 'color': '#ff0000'},
    )
    assert create_response.status_code == 200, f'Failed: {create_response.text}'
    list_id = create_response.json()['id']

    # Get list
    response = client.get(f'/api/lists/{list_id}')
    assert response.status_code == 200
    data = response.json()
    assert data['name'] == name
    assert 'entries' in data


def test_get_nonexistent_list(client: TestClient, db_session: Session):
    """Test getting a nonexistent list returns 404"""
    response = client.get('/api/lists/99999')
    assert response.status_code == 404


def test_update_list(client: TestClient, db_session: Session):
    """Test updating a list"""
    # Create
    name = unique_name('Original Name')
    create_response = client.post('/api/lists', json={'name': name, 'color': '#ff0000'})
    assert create_response.status_code == 200, f'Failed: {create_response.text}'
    list_id = create_response.json()['id']

    # Update
    new_name = unique_name('Updated Name')
    response = client.put(
        f'/api/lists/{list_id}',
        json={'name': new_name, 'color': '#00ff00'},
    )
    assert response.status_code == 200, f'Failed: {response.text}'
    data = response.json()
    assert data['name'] == new_name
    assert data['color'] == '#00ff00'


def test_update_list_duplicate_name(client: TestClient, db_session: Session):
    """Test that updating to a duplicate name fails"""
    name_a = unique_name('List A')
    name_b = unique_name('List B')

    client.post('/api/lists', json={'name': name_a})
    create_response = client.post('/api/lists', json={'name': name_b})
    assert create_response.status_code == 200, f'Failed: {create_response.text}'
    list_b_id = create_response.json()['id']

    # Try to rename B to A
    response = client.put(f'/api/lists/{list_b_id}', json={'name': name_a})
    assert response.status_code == 400


def test_delete_list(client: TestClient, db_session: Session):
    """Test deleting a list"""
    # Create
    name = unique_name('Test List')
    create_response = client.post('/api/lists', json={'name': name})
    list_id = create_response.json()['id']

    # Delete
    response = client.delete(f'/api/lists/{list_id}')
    assert response.status_code == 200

    # Verify deleted
    get_response = client.get(f'/api/lists/{list_id}')
    assert get_response.status_code == 404


def test_add_entry_to_list(client: TestClient, db_session: Session):
    """Test adding an entry to a list"""
    # Setup
    date = unique_date()
    note_response = client.post('/api/notes/', json={'date': date})
    assert note_response.status_code == 201, f'Failed: {note_response.text}'
    note_id = note_response.json()['id']

    entry_response = client.post(
        f'/api/entries/note/{note_id}',
        json={'content': 'Test entry', 'content_type': 'rich_text', 'order_index': 0},
    )
    assert entry_response.status_code == 201, f'Failed: {entry_response.text}'
    entry_id = entry_response.json()['id']

    list_name = unique_name('Test List')
    list_response = client.post('/api/lists', json={'name': list_name})
    assert list_response.status_code == 200, f'Failed: {list_response.text}'
    list_id = list_response.json()['id']

    # Add entry to list
    response = client.post(f'/api/lists/{list_id}/entries/{entry_id}')
    assert response.status_code == 200

    # Verify entry is in list
    list_data = client.get(f'/api/lists/{list_id}').json()
    assert len(list_data['entries']) == 1
    assert list_data['entries'][0]['id'] == entry_id


def test_remove_entry_from_list(client: TestClient, db_session: Session):
    """Test removing an entry from a list"""
    # Setup
    date = unique_date()
    note_response = client.post('/api/notes/', json={'date': date})
    assert note_response.status_code == 201, f'Failed: {note_response.text}'
    note_id = note_response.json()['id']

    entry_response = client.post(
        f'/api/entries/note/{note_id}',
        json={'content': 'Test entry', 'content_type': 'rich_text', 'order_index': 0},
    )
    assert entry_response.status_code == 201, f'Failed: {entry_response.text}'
    entry_id = entry_response.json()['id']

    list_name = unique_name('Test List')
    list_response = client.post('/api/lists', json={'name': list_name})
    assert list_response.status_code == 200, f'Failed: {list_response.text}'
    list_id = list_response.json()['id']

    # Add entry then remove it
    client.post(f'/api/lists/{list_id}/entries/{entry_id}')
    response = client.delete(f'/api/lists/{list_id}/entries/{entry_id}')
    assert response.status_code == 200

    # Verify entry is removed
    list_get_response = client.get(f'/api/lists/{list_id}')
    entries = list_get_response.json()['entries']
    assert len(entries) == 0


def test_entry_in_multiple_lists(client: TestClient, db_session: Session):
    """Test that an entry can belong to multiple lists"""
    # Setup
    date = unique_date()
    note_response = client.post('/api/notes/', json={'date': date})
    assert note_response.status_code == 201, f'Failed: {note_response.text}'
    note_id = note_response.json()['id']

    entry_response = client.post(
        f'/api/entries/note/{note_id}',
        json={
            'content': 'Multi-list entry',
            'content_type': 'rich_text',
            'order_index': 0,
        },
    )
    assert entry_response.status_code == 201, f'Failed: {entry_response.text}'
    entry_id = entry_response.json()['id']

    # Create two lists with unique names
    list1_name = unique_name('Multi List A')
    list1_response = client.post('/api/lists', json={'name': list1_name, 'color': '#ff0000'})
    assert list1_response.status_code == 200, f'Failed to create list 1: {list1_response.text}'
    list1_id = list1_response.json()['id']

    list2_name = unique_name('Multi List B')
    list2_response = client.post('/api/lists', json={'name': list2_name, 'color': '#00ff00'})
    assert list2_response.status_code == 200, f'Failed to create list 2: {list2_response.text}'
    list2_id = list2_response.json()['id']

    # Add entry to both lists
    client.post(f'/api/lists/{list1_id}/entries/{entry_id}')
    client.post(f'/api/lists/{list2_id}/entries/{entry_id}')

    # Verify entry is in both lists
    list1_data = client.get(f'/api/lists/{list1_id}').json()
    list2_data = client.get(f'/api/lists/{list2_id}').json()

    assert len(list1_data['entries']) == 1
    assert len(list2_data['entries']) == 1
    assert list1_data['entries'][0]['id'] == entry_id
    assert list2_data['entries'][0]['id'] == entry_id


def test_delete_list_preserves_entries(client: TestClient, db_session: Session):
    """Test that deleting a list doesn't delete the entries"""
    # Setup
    date = unique_date()
    note_response = client.post('/api/notes/', json={'date': date})
    assert note_response.status_code == 201, f'Failed: {note_response.text}'
    note_id = note_response.json()['id']

    entry_response = client.post(
        f'/api/entries/note/{note_id}',
        json={'content': 'Test entry', 'content_type': 'rich_text', 'order_index': 0},
    )
    assert entry_response.status_code == 201, f'Failed: {entry_response.text}'
    entry_id = entry_response.json()['id']

    list_name = unique_name('Test List')
    list_response = client.post('/api/lists', json={'name': list_name})
    assert list_response.status_code == 200, f'Failed: {list_response.text}'
    list_id = list_response.json()['id']

    # Add entry to list then delete list
    client.post(f'/api/lists/{list_id}/entries/{entry_id}')
    client.delete(f'/api/lists/{list_id}')

    # Verify entry still exists
    entry_get_response = client.get(f'/api/entries/{entry_id}')
    assert entry_get_response.status_code == 200


def test_archive_list(client: TestClient, db_session: Session):
    """Test archiving a list"""
    # Create
    name = unique_name('Test List')
    list_response = client.post('/api/lists', json={'name': name})
    assert list_response.status_code == 200, f'Failed: {list_response.text}'
    list_id = list_response.json()['id']

    # Archive
    response = client.put(f'/api/lists/{list_id}', json={'is_archived': True})
    assert response.status_code == 200
    data = response.json()
    assert data['is_archived'] is True

    # Verify archived lists are not in default response
    all_lists = client.get('/api/lists').json()
    assert not any(lst['id'] == list_id for lst in all_lists)

    # Verify archived lists can be retrieved with flag
    archived_lists = client.get('/api/lists?include_archived=true').json()
    assert any(lst['id'] == list_id for lst in archived_lists)
