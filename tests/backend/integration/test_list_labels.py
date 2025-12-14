"""
Integration tests for list labels feature.
Tests the ability to add and remove labels from lists.
"""

from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session


def test_add_label_to_list(client: TestClient, db_session: Session):
    """Test adding a label to a list."""
    timestamp = datetime.now().isoformat()
    # Create a list
    list_data = {
        'name': f'Test List {timestamp}',
        'description': 'A test list',
        'color': '#FF5733',
    }
    list_response = client.post('/api/lists', json=list_data)
    assert list_response.status_code == 200
    list_id = list_response.json()['id']

    # Create a label
    label_data = {'name': f'test-label-{timestamp}', 'color': '#00FF00'}
    label_response = client.post('/api/labels/', json=label_data)
    assert label_response.status_code == 201
    label_id = label_response.json()['id']

    # Add label to list
    add_response = client.post(f'/api/lists/{list_id}/labels/{label_id}')
    assert add_response.status_code == 200

    # Verify label is associated with list
    list_get_response = client.get(f'/api/lists/{list_id}')
    assert list_get_response.status_code == 200
    list_data = list_get_response.json()
    assert len(list_data['labels']) == 1
    assert list_data['labels'][0]['id'] == label_id
    assert list_data['labels'][0]['name'] == f'test-label-{timestamp}'


def test_remove_label_from_list(client: TestClient, db_session: Session):
    """Test removing a label from a list."""
    timestamp = datetime.now().isoformat()
    # Create a list
    list_data = {
        'name': f'Test List 2 {timestamp}',
        'description': 'Another test list',
        'color': '#3366FF',
    }
    list_response = client.post('/api/lists', json=list_data)
    assert list_response.status_code == 200
    list_id = list_response.json()['id']

    # Create a label
    label_data = {'name': f'removable-label-{timestamp}', 'color': '#FF00FF'}
    label_response = client.post('/api/labels/', json=label_data)
    assert label_response.status_code == 201
    label_id = label_response.json()['id']

    # Add label to list
    add_response = client.post(f'/api/lists/{list_id}/labels/{label_id}')
    assert add_response.status_code == 200

    # Remove label from list
    remove_response = client.delete(f'/api/lists/{list_id}/labels/{label_id}')
    assert remove_response.status_code == 200

    # Verify label is no longer associated with list
    list_get_response = client.get(f'/api/lists/{list_id}')
    assert list_get_response.status_code == 200
    list_data = list_get_response.json()
    assert len(list_data['labels']) == 0


def test_add_multiple_labels_to_list(client: TestClient, db_session: Session):
    """Test adding multiple labels to a single list."""
    timestamp = datetime.now().isoformat()
    # Create a list
    list_data = {
        'name': f'Multi-Label List {timestamp}',
        'description': 'List with multiple labels',
        'color': '#FFAA00',
    }
    list_response = client.post('/api/lists', json=list_data)
    assert list_response.status_code == 200
    list_id = list_response.json()['id']

    # Create multiple labels
    label_ids = []
    for i in range(3):
        label_data = {'name': f'label-{i}-{timestamp}', 'color': f'#00{i}{i}00'}
        label_response = client.post('/api/labels/', json=label_data)
        assert label_response.status_code == 201
        label_ids.append(label_response.json()['id'])

    # Add all labels to list
    for label_id in label_ids:
        add_response = client.post(f'/api/lists/{list_id}/labels/{label_id}')
        assert add_response.status_code == 200

    # Verify all labels are associated with list
    list_get_response = client.get(f'/api/lists/{list_id}')
    assert list_get_response.status_code == 200
    list_data = list_get_response.json()
    assert len(list_data['labels']) == 3
    returned_label_ids = [label['id'] for label in list_data['labels']]
    for label_id in label_ids:
        assert label_id in returned_label_ids


def test_list_labels_in_get_all_lists(client: TestClient, db_session: Session):
    """Test that labels are included when getting all lists."""
    timestamp = datetime.now().isoformat()
    # Create a list
    list_data = {
        'name': f'List for GetAll Test {timestamp}',
        'description': 'Testing get all lists',
        'color': '#AA00FF',
    }
    list_response = client.post('/api/lists', json=list_data)
    assert list_response.status_code == 200
    list_id = list_response.json()['id']

    # Create and add a label
    label_data = {'name': f'getall-label-{timestamp}', 'color': '#FFFF00'}
    label_response = client.post('/api/labels/', json=label_data)
    assert label_response.status_code == 201
    label_id = label_response.json()['id']

    client.post(f'/api/lists/{list_id}/labels/{label_id}')

    # Get all lists
    all_lists_response = client.get('/api/lists')
    assert all_lists_response.status_code == 200
    all_lists = all_lists_response.json()

    # Find our list
    our_list = next((lst for lst in all_lists if lst['id'] == list_id), None)
    assert our_list is not None
    assert len(our_list['labels']) == 1
    assert our_list['labels'][0]['id'] == label_id


def test_add_nonexistent_label_to_list(client: TestClient, db_session: Session):
    """Test adding a non-existent label to a list returns 404."""
    timestamp = datetime.now().isoformat()
    # Create a list
    list_data = {
        'name': f'Test List {timestamp}',
        'description': 'A test list',
        'color': '#FF5733',
    }
    list_response = client.post('/api/lists', json=list_data)
    assert list_response.status_code == 200
    list_id = list_response.json()['id']

    # Try to add non-existent label
    add_response = client.post(f'/api/lists/{list_id}/labels/99999')
    assert add_response.status_code == 404


def test_add_label_to_nonexistent_list(client: TestClient, db_session: Session):
    """Test adding a label to a non-existent list returns 404."""
    timestamp = datetime.now().isoformat()
    # Create a label
    label_data = {'name': f'test-label-{timestamp}', 'color': '#00FF00'}
    label_response = client.post('/api/labels/', json=label_data)
    assert label_response.status_code == 201
    label_id = label_response.json()['id']

    # Try to add label to non-existent list
    add_response = client.post(f'/api/lists/99999/labels/{label_id}')
    assert add_response.status_code == 404


def test_cascade_delete_list_removes_label_associations(client: TestClient, db_session: Session):
    """Test that deleting a list removes its label associations."""
    timestamp = datetime.now().isoformat()
    # Create a list
    list_data = {
        'name': f'Deletable List {timestamp}',
        'description': 'Will be deleted',
        'color': '#FF0000',
    }
    list_response = client.post('/api/lists', json=list_data)
    assert list_response.status_code == 200
    list_id = list_response.json()['id']

    # Create and add a label
    label_data = {'name': f'cascade-label-{timestamp}', 'color': '#00FFFF'}
    label_response = client.post('/api/labels/', json=label_data)
    assert label_response.status_code == 201
    label_id = label_response.json()['id']

    client.post(f'/api/lists/{list_id}/labels/{label_id}')

    # Delete the list
    delete_response = client.delete(f'/api/lists/{list_id}')
    assert delete_response.status_code == 200

    # Verify the association is gone (check in database)
    association = db_session.execute(
        text('SELECT * FROM list_labels WHERE list_id = :list_id AND label_id = :label_id'),
        {'list_id': list_id, 'label_id': label_id},
    ).fetchone()
    assert association is None
