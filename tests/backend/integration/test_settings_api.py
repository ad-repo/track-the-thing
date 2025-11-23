"""
Integration tests for /api/settings endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AppSettings


@pytest.mark.integration
class TestAppSettingsAPI:
    """Verify app settings defaults and update behavior."""

    def test_get_settings_creates_defaults(self, client: TestClient, db_session: Session):
        """First GET should create default settings row with expected fallback values."""
        assert db_session.query(AppSettings).count() == 0

        response = client.get('/api/settings')

        assert response.status_code == 200
        data = response.json()
        assert data['emoji_library'] == 'emoji-picker-react'
        assert data['sprint_name'] == 'Sprint'
        assert data['daily_goal_end_time'] == '17:00'
        assert data['texture_enabled'] is False
        assert db_session.query(AppSettings).count() == 1

    def test_patch_updates_allows_boolean_fields(self, client: TestClient):
        """PATCH should update provided fields and convert booleans."""
        payload = {
            'sprint_goals': 'Ship onboarding',
            'quarterly_goals': 'Grow retention',
            'sprint_start_date': '2025-11-01',
            'sprint_end_date': '2025-11-14',
            'quarterly_start_date': '2025-10-01',
            'quarterly_end_date': '2025-12-31',
            'emoji_library': 'emoji-mart',
            'sprint_name': 'Focus Sprint',
            'daily_goal_end_time': '18:30',
            'texture_enabled': True,
            'texture_settings': '{"pattern":"dots"}',
        }

        response = client.patch('/api/settings', json=payload)

        assert response.status_code == 200
        data = response.json()
        for key, value in payload.items():
            expected_value = bool(value) if key == 'texture_enabled' else value
            assert data[key] == expected_value
        assert data['texture_enabled'] is True

    def test_patch_creates_settings_when_missing(self, client: TestClient, db_session: Session):
        """PATCH should create the settings row if it was deleted."""
        client.get('/api/settings')
        db_session.query(AppSettings).delete()
        db_session.commit()

        response = client.patch('/api/settings', json={'sprint_goals': 'Restore defaults'})

        assert response.status_code == 200
        data = response.json()
        assert data['sprint_goals'] == 'Restore defaults'
        assert db_session.query(AppSettings).count() == 1
