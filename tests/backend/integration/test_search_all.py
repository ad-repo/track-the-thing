"""
Integration tests for the /api/search/all endpoint.
Tests searching both entries and lists with label filtering.
"""

from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_search_all_returns_both_entries_and_lists(client: TestClient, db_session: Session):
    """Test that search/all returns both entries and lists."""
    timestamp = datetime.now().isoformat()

    # Create an entry (this will create the daily note automatically)
    unique_date = datetime.now().strftime('%Y-%m-%d')
    entry_data = {'content': f'Searchable entry content {timestamp}', 'order_index': 0}
    entry_response = client.post(f'/api/entries/note/{unique_date}', json=entry_data)
    assert entry_response.status_code == 201

    # Create a list
    list_data = {
        'name': f'Searchable List {timestamp}',
        'description': 'A searchable list',
        'color': '#FF5733',
    }
    list_response = client.post('/api/lists', json=list_data)
    assert list_response.status_code == 200

    # Search for the timestamp
    search_response = client.get('/api/search/all', params={'q': timestamp})
    assert search_response.status_code == 200

    data = search_response.json()
    assert 'entries' in data
    assert 'lists' in data
    assert len(data['entries']) >= 1
    assert len(data['lists']) >= 1


def test_search_all_by_label_returns_matching_entries_and_lists(client: TestClient, db_session: Session):
    """Test searching by label returns both entries and lists with that label."""
    timestamp = datetime.now().isoformat()

    # Create a label
    label_data = {'name': f'search-label-{timestamp}', 'color': '#00FF00'}
    label_response = client.post('/api/labels/', json=label_data)
    assert label_response.status_code == 201
    label_id = label_response.json()['id']

    # Create an entry (this will create the daily note automatically)
    unique_date = datetime.now().strftime('%Y-%m-%d')
    entry_data = {'content': f'Entry with label {timestamp}', 'order_index': 0}
    entry_response = client.post(f'/api/entries/note/{unique_date}', json=entry_data)
    assert entry_response.status_code == 201
    entry_id = entry_response.json()['id']

    # Add label to entry
    add_label_response = client.post(f'/api/labels/entry/{entry_id}/label/{label_id}')
    assert add_label_response.status_code == 204

    # Create a list with the same label
    list_data = {
        'name': f'List with label {timestamp}',
        'description': 'A list with label',
        'color': '#3366FF',
    }
    list_response = client.post('/api/lists', json=list_data)
    assert list_response.status_code == 200
    list_id = list_response.json()['id']

    # Add label to list
    add_list_label_response = client.post(f'/api/lists/{list_id}/labels/{label_id}')
    assert add_list_label_response.status_code == 200

    # Search by label
    search_response = client.get('/api/search/all', params={'label_ids': str(label_id)})
    assert search_response.status_code == 200

    data = search_response.json()
    assert len(data['entries']) >= 1
    assert len(data['lists']) >= 1

    # Verify the entry has the label
    entry_found = any(e['id'] == entry_id for e in data['entries'])
    assert entry_found

    # Verify the list has the label
    list_found = any(lst['id'] == list_id for lst in data['lists'])
    assert list_found


def test_search_all_by_text_in_list_name(client: TestClient, db_session: Session):
    """Test searching by text matches list names."""
    timestamp = datetime.now().isoformat()
    unique_name = f'UniqueListName{timestamp}'

    list_data = {
        'name': unique_name,
        'description': 'A unique list',
        'color': '#FFAA00',
    }
    list_response = client.post('/api/lists', json=list_data)
    assert list_response.status_code == 200
    list_id = list_response.json()['id']

    # Search by the unique name
    search_response = client.get('/api/search/all', params={'q': unique_name})
    assert search_response.status_code == 200

    data = search_response.json()
    assert len(data['lists']) >= 1
    list_found = any(lst['id'] == list_id for lst in data['lists'])
    assert list_found


def test_search_all_by_text_in_list_description(client: TestClient, db_session: Session):
    """Test searching by text matches list descriptions."""
    timestamp = datetime.now().isoformat()
    unique_desc = f'UniqueDescription{timestamp}'

    list_data = {
        'name': f'Regular Name {timestamp}',
        'description': unique_desc,
        'color': '#AA00FF',
    }
    list_response = client.post('/api/lists', json=list_data)
    assert list_response.status_code == 200
    list_id = list_response.json()['id']

    # Search by the unique description
    search_response = client.get('/api/search/all', params={'q': unique_desc})
    assert search_response.status_code == 200

    data = search_response.json()
    assert len(data['lists']) >= 1
    list_found = any(lst['id'] == list_id for lst in data['lists'])
    assert list_found


def test_search_all_empty_query_with_no_filters(client: TestClient, db_session: Session):
    """Test that search/all with no query or filters returns valid structure."""
    # Search with a very specific query that won't match anything
    search_response = client.get('/api/search/all', params={'q': 'ZZZZNONEXISTENT9999'})
    assert search_response.status_code == 200

    data = search_response.json()
    # Should return structure even with no results
    assert 'entries' in data
    assert 'lists' in data
    assert isinstance(data['entries'], list)
    assert isinstance(data['lists'], list)


def test_search_all_includes_list_entry_count(client: TestClient, db_session: Session):
    """Test that list results include entry_count."""
    timestamp = datetime.now().isoformat()

    # Create a list
    list_data = {
        'name': f'List with entries {timestamp}',
        'description': 'Has entries',
        'color': '#FF00FF',
    }
    list_response = client.post('/api/lists', json=list_data)
    assert list_response.status_code == 200
    list_id = list_response.json()['id']

    # Create an entry (this will create the daily note automatically)
    unique_date = datetime.now().strftime('%Y-%m-%d')
    entry_data = {'content': 'Entry in list', 'order_index': 0}
    entry_response = client.post(f'/api/entries/note/{unique_date}', json=entry_data)
    assert entry_response.status_code == 201
    entry_id = entry_response.json()['id']

    # Add entry to list
    client.post(f'/api/lists/{list_id}/entries/{entry_id}')

    # Search for the list
    search_response = client.get('/api/search/all', params={'q': timestamp})
    assert search_response.status_code == 200

    data = search_response.json()
    list_result = next((lst for lst in data['lists'] if lst['id'] == list_id), None)
    assert list_result is not None
    assert 'entry_count' in list_result
    assert list_result['entry_count'] >= 1


def test_search_all_includes_list_labels(client: TestClient, db_session: Session):
    """Test that list results include labels."""
    timestamp = datetime.now().isoformat()

    # Create a list
    list_data = {
        'name': f'List with labels {timestamp}',
        'description': 'Has labels',
        'color': '#00FFFF',
    }
    list_response = client.post('/api/lists', json=list_data)
    assert list_response.status_code == 200
    list_id = list_response.json()['id']

    # Create and add a label
    label_data = {'name': f'list-search-label-{timestamp}', 'color': '#FFFF00'}
    label_response = client.post('/api/labels/', json=label_data)
    assert label_response.status_code == 201
    label_id = label_response.json()['id']

    client.post(f'/api/lists/{list_id}/labels/{label_id}')

    # Search for the list
    search_response = client.get('/api/search/all', params={'q': timestamp})
    assert search_response.status_code == 200

    data = search_response.json()
    list_result = next((lst for lst in data['lists'] if lst['id'] == list_id), None)
    assert list_result is not None
    assert 'labels' in list_result
    assert len(list_result['labels']) == 1
    assert list_result['labels'][0]['id'] == label_id


def test_search_all_includes_is_pinned_in_entries(client: TestClient, db_session: Session):
    """Test that entry results include is_pinned field."""
    timestamp = datetime.now().isoformat()

    # Create an entry (this will create the daily note automatically)
    unique_date = datetime.now().strftime('%Y-%m-%d')
    entry_data = {'content': f'Pinned entry {timestamp}', 'order_index': 0}
    entry_response = client.post(f'/api/entries/note/{unique_date}', json=entry_data)
    assert entry_response.status_code == 201
    entry_id = entry_response.json()['id']

    # Pin the entry
    client.post(f'/api/entries/{entry_id}/toggle-pin')

    # Search for the entry
    search_response = client.get('/api/search/all', params={'q': timestamp})
    assert search_response.status_code == 200

    data = search_response.json()
    entry_result = next((e for e in data['entries'] if e['id'] == entry_id), None)
    assert entry_result is not None
    assert 'is_pinned' in entry_result
    assert entry_result['is_pinned'] is True
