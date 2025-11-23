"""
Integration tests for /api/search-history endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import SearchHistory


@pytest.mark.integration
class TestSearchHistoryAPI:
    """Validate search history CRUD plus deduplication logic."""

    def test_add_and_get_search_history_dedupes(self, client: TestClient):
        """GET should return unique queries ordered by most recent timestamp."""
        client.post('/api/search-history', params={'query': 'python'})
        client.post('/api/search-history', params={'query': 'fastapi'})
        client.post('/api/search-history', params={'query': 'python'})  # duplicate to update timestamp

        response = client.get('/api/search-history')
        assert response.status_code == 200
        data = response.json()
        assert [item['query'] for item in data] == ['python', 'fastapi']
        assert data[0]['created_at'] >= data[1]['created_at']

    def test_add_search_history_ignores_blank_queries(self, client: TestClient, db_session: Session):
        """Whitespace-only queries should not be persisted."""
        response = client.post('/api/search-history', params={'query': '   '})
        assert response.status_code == 201
        assert response.json()['message'] == 'Empty query not saved'
        assert db_session.query(SearchHistory).count() == 0

    def test_clear_search_history(self, client: TestClient, db_session: Session):
        """DELETE should remove all stored queries."""
        client.post('/api/search-history', params={'query': 'one'})
        client.post('/api/search-history', params={'query': 'two'})
        assert db_session.query(SearchHistory).count() == 2

        response = client.delete('/api/search-history')
        assert response.status_code == 204
        assert db_session.query(SearchHistory).count() == 0
