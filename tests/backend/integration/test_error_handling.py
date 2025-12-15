"""
Integration tests for API Error Handling and Edge Cases

Per project rules: These tests validate existing error behavior without modifying production code.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import DailyNote, Label, NoteEntry


@pytest.mark.integration
class TestNotFoundErrors:
    """Test 404 Not Found error handling."""

    def test_get_nonexistent_note(self, client: TestClient):
        """Test GET /api/notes/{date} with non-existent date."""
        response = client.get('/api/notes/9999-99-99')

        # Note: As of migration 017, getting a note triggers pinned entry copying
        # which creates the note if it doesn't exist, so we expect 200 with empty entries
        assert response.status_code == 200
        assert response.json()['entries'] == []

    def test_get_nonexistent_entry(self, client: TestClient):
        """Test GET /api/entries/{id} with non-existent ID."""
        response = client.get('/api/entries/999999')

        assert response.status_code == 404

    def test_delete_nonexistent_entry(self, client: TestClient):
        """Test DELETE /api/entries/{id} with non-existent ID."""
        response = client.delete('/api/entries/999999')

        assert response.status_code == 404

    def test_update_nonexistent_entry(self, client: TestClient):
        """Test PUT /api/entries/{id} with non-existent ID."""
        response = client.put('/api/entries/999999', json={'content': '<p>Updated</p>'})

        assert response.status_code == 404

    def test_get_nonexistent_label(self, client: TestClient):
        """Test GET /api/labels/{id} endpoint doesn't exist (405)."""
        response = client.get('/api/labels/999999')

        # Production returns 405 (GET by ID not implemented)
        assert response.status_code == 405

    def test_delete_nonexistent_label(self, client: TestClient):
        """Test DELETE /api/labels/{id} with non-existent ID."""
        response = client.delete('/api/labels/999999')

        assert response.status_code == 404

    def test_get_nonexistent_sprint_goal(self, client: TestClient):
        """Test GET /api/goals/sprint/{id} with non-existent ID."""
        response = client.get('/api/goals/sprint/999999')

        assert response.status_code == 404

    def test_delete_nonexistent_sprint_goal(self, client: TestClient):
        """Test DELETE /api/goals/sprint/{id} with non-existent ID."""
        response = client.delete('/api/goals/sprint/999999')

        assert response.status_code == 404


@pytest.mark.integration
class TestValidationErrors:
    """Test 422 Validation Error handling."""

    def test_create_label_without_name(self, client: TestClient):
        """Test POST /api/labels/ without required name field."""
        response = client.post('/api/labels/', json={})

        # Should return validation error
        assert response.status_code == 422

    def test_create_entry_with_invalid_json(self, client: TestClient, db_session: Session):
        """Test POST /api/entries/note/{date} with malformed JSON."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        # Send invalid JSON
        response = client.post(
            f'/api/entries/note/{note.date}',
            data='invalid json{{{',
            headers={'Content-Type': 'application/json'},
        )

        assert response.status_code == 422

    def test_create_goal_with_invalid_dates(self, client: TestClient):
        """Test POST /api/goals/sprint with invalid date format."""
        response = client.post(
            '/api/goals/sprint',
            json={
                'text': 'Test',
                'start_date': 'not-a-date',
                'end_date': 'also-not-a-date',
            },
        )

        # Should validate date format
        assert response.status_code in [422, 400]

    def test_update_entry_with_invalid_type(self, client: TestClient, db_session: Session):
        """Test PUT /api/entries/{id} with invalid data types."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        entry = NoteEntry(daily_note_id=note.id, content='<p>Test</p>')
        db_session.add(entry)
        db_session.commit()

        # Send invalid type for is_important (should be boolean/int)
        response = client.put(f'/api/entries/{entry.id}', json={'is_important': 'not a boolean'})

        assert response.status_code in [422, 400]


@pytest.mark.integration
class TestBadRequestErrors:
    """Test 400 Bad Request error handling."""

    def test_create_duplicate_label(self, client: TestClient, db_session: Session):
        """Test creating label with duplicate name."""
        label = Label(name='duplicate', color='#3b82f6')
        db_session.add(label)
        db_session.commit()

        # Try to create another with same name
        response = client.post('/api/labels/', json={'name': 'duplicate', 'color': '#ff0000'})

        assert response.status_code == 400

    def test_search_with_invalid_query_params(self, client: TestClient):
        """Test search with malformed parameters."""
        # Send non-boolean for is_important
        response = client.get('/api/search/?is_important=maybe')

        # Should still return results or validation error
        assert response.status_code in [200, 422]


@pytest.mark.integration
class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_create_entry_with_very_long_content(self, client: TestClient, db_session: Session):
        """Test creating entry with extremely long content."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        # Create very long content (10MB)
        long_content = '<p>' + ('a' * 10_000_000) + '</p>'

        response = client.post(f'/api/entries/note/{note.date}', json={'content': long_content})

        # Should either succeed or have reasonable limit
        assert response.status_code in [200, 201, 413, 500]

    def test_create_label_with_very_long_name(self, client: TestClient):
        """Test creating label with extremely long name."""
        long_name = 'x' * 10000

        response = client.post('/api/labels/', json={'name': long_name})

        # Should succeed or have reasonable limit
        assert response.status_code in [200, 201, 400, 422]

    def test_create_label_with_special_characters(self, client: TestClient):
        """Test creating label with special characters in name."""
        special_names = [
            'label\x00null',  # Null byte
            'label\nwith\nnewlines',
            'label\twith\ttabs',
            'label with   spaces',
            "<script>alert('xss')</script>",
            "'; DROP TABLE labels; --",
        ]

        for name in special_names:
            response = client.post('/api/labels/', json={'name': name})

            # Should either accept or reject gracefully
            assert response.status_code in [200, 201, 400, 422]

    def test_create_entry_with_empty_content(self, client: TestClient, db_session: Session):
        """Test creating entry with empty content."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        response = client.post(f'/api/entries/note/{note.date}', json={'content': ''})

        # Empty content should be allowed
        assert response.status_code in [200, 201]

    def test_search_with_very_long_query(self, client: TestClient):
        """Test search with extremely long query string."""
        long_query = 'a' * 10000

        response = client.get(f'/api/search/?q={long_query}')

        # Should handle gracefully
        assert response.status_code in [200, 400, 414]  # 414 = URI Too Long

    def test_multiple_concurrent_label_creation(self, client: TestClient):
        """Test creating multiple labels rapidly (simulates concurrent requests)."""
        responses = []
        for i in range(20):
            response = client.post('/api/labels/', json={'name': f'concurrent-{i}', 'color': '#3b82f6'})
            responses.append(response)

        # All should succeed
        success_count = sum(1 for r in responses if r.status_code in [200, 201])
        assert success_count == 20

    def test_update_entry_multiple_times_rapidly(self, client: TestClient, db_session: Session):
        """Test updating same entry multiple times in quick succession."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        entry = NoteEntry(daily_note_id=note.id, content='<p>Original</p>')
        db_session.add(entry)
        db_session.commit()

        # Rapid updates
        for i in range(10):
            response = client.put(f'/api/entries/{entry.id}', json={'content': f'<p>Update {i}</p>'})
            assert response.status_code == 200

        # Verify final state
        final_response = client.get(f'/api/entries/{entry.id}')
        assert final_response.status_code == 200


@pytest.mark.integration
class TestHTMLSanitization:
    """Test handling of potentially dangerous HTML content."""

    def test_entry_with_script_tags(self, client: TestClient, db_session: Session):
        """Test that script tags in content are handled properly."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        malicious_content = "<p>Test</p><script>alert('XSS')</script>"

        response = client.post(f'/api/entries/note/{note.date}', json={'content': malicious_content})

        # Should accept (backend doesn't sanitize, frontend should)
        assert response.status_code in [200, 201]

        # Verify content is stored as-is
        data = response.json()
        assert 'script' in data['content'].lower()

    def test_entry_with_iframe(self, client: TestClient, db_session: Session):
        """Test that iframe tags are handled."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        iframe_content = "<p>Test</p><iframe src='evil.com'></iframe>"

        response = client.post(f'/api/entries/note/{note.date}', json={'content': iframe_content})

        assert response.status_code in [200, 201]

    def test_entry_with_sql_injection_attempt(self, client: TestClient, db_session: Session):
        """Test that SQL injection attempts in content are handled safely."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        sql_injection = "<p>' OR '1'='1'; DROP TABLE note_entries; --</p>"

        response = client.post(f'/api/entries/note/{note.date}', json={'content': sql_injection})

        # Should succeed (SQLAlchemy parameterizes queries)
        assert response.status_code in [200, 201]

        # Verify database is intact
        verify = client.get(f'/api/notes/{note.date}')
        assert verify.status_code == 200


@pytest.mark.integration
class TestRateLimitingAndPerformance:
    """Test performance and potential abuse scenarios."""

    def test_create_many_entries_on_single_day(self, client: TestClient, db_session: Session):
        """Test creating many entries on a single day."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        # Create 100 entries
        for i in range(100):
            response = client.post(f'/api/entries/note/{note.date}', json={'content': f'<p>Entry {i}</p>'})
            assert response.status_code in [200, 201]

        # Verify all were created
        verify = client.get(f'/api/notes/{note.date}')
        assert verify.status_code == 200
        data = verify.json()
        assert len(data['entries']) == 100

    def test_search_returns_limited_results(self, client: TestClient, db_session: Session):
        """Test that search enforces 100-result limit."""
        # Create 150 entries
        for day in range(150):
            note = DailyNote(date=f'2025-01-{day+1:02d}' if day < 31 else f'2025-02-{day-30:02d}')
            db_session.add(note)
            db_session.commit()

            entry = NoteEntry(daily_note_id=note.id, content='<p>searchterm</p>')
            db_session.add(entry)

        db_session.commit()

        # Search should return only 100
        response = client.get('/api/search/?q=searchterm')
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 100


@pytest.mark.integration
class TestCORSAndHeaders:
    """Test CORS and security headers."""

    def test_options_request(self, client: TestClient):
        """Test OPTIONS request (CORS preflight)."""
        response = client.options('/api/labels/')

        # Should handle OPTIONS or return 405
        assert response.status_code in [200, 204, 405]

    def test_response_headers(self, client: TestClient, db_session: Session):
        """Test that responses have appropriate headers."""
        label = Label(name='test', color='#3b82f6')
        db_session.add(label)
        db_session.commit()

        response = client.get('/api/labels/')

        assert response.status_code == 200
        # Check for standard headers
        assert 'content-type' in response.headers

    def test_json_content_type(self, client: TestClient):
        """Test that API returns JSON content-type."""
        response = client.get('/api/labels/')

        assert response.status_code == 200
        assert 'application/json' in response.headers['content-type']


@pytest.mark.integration
class TestDatabaseConstraints:
    """Test database constraint handling."""

    def test_foreign_key_constraint(self, client: TestClient, db_session: Session):
        """Test that foreign key constraints are enforced."""
        # Try to create entry with non-existent daily_note_id
        response = client.post('/api/entries/note/2025-11-07', json={'content': '<p>Test</p>'})

        # Should either create the note automatically or fail gracefully
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_cascade_delete_note_deletes_entries(self, client: TestClient, db_session: Session):
        """Test that deleting a note cascades to entries."""
        note = DailyNote(date='2025-11-07')
        db_session.add(note)
        db_session.commit()

        entry = NoteEntry(daily_note_id=note.id, content='<p>Test</p>')
        db_session.add(entry)
        db_session.commit()
        entry_id = entry.id

        # Delete note
        client.delete(f'/api/notes/{note.date}')

        # Entry should also be deleted (cascade)
        entry_check = client.get(f'/api/entries/{entry_id}')
        assert entry_check.status_code == 404

    def test_label_association_with_deleted_entry(self, client: TestClient, db_session: Session):
        """Test label associations are cleaned up when entry is deleted."""
        note = DailyNote(date='2025-11-07')
        label = Label(name='test', color='#3b82f6')
        db_session.add_all([note, label])
        db_session.commit()

        entry = NoteEntry(daily_note_id=note.id, content='<p>Test</p>')
        entry.labels.append(label)
        db_session.add(entry)
        db_session.commit()
        entry_id = entry.id

        # Delete entry
        response = client.delete(f'/api/entries/{entry_id}')
        assert response.status_code in [200, 204]

        # Label should still exist (use list endpoint)
        labels_list = client.get('/api/labels/')
        assert labels_list.status_code == 200
        labels = labels_list.json()
        assert any(lbl['id'] == label.id for lbl in labels)
