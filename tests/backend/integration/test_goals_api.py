"""
Integration tests for Unified Goals API endpoints
"""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
class TestGoalTypesAPI:
    """Test /api/goals/types endpoint."""

    def test_get_goal_types(self, client: TestClient):
        """Test GET /api/goals/types returns all goal type categories."""
        response = client.get('/api/goals/types')

        assert response.status_code == 200
        data = response.json()
        assert 'time_based' in data
        assert 'lifestyle' in data
        assert 'all_preset' in data

        # Verify time-based types
        assert 'Daily' in data['time_based']
        assert 'Weekly' in data['time_based']
        assert 'Sprint' in data['time_based']
        assert 'Monthly' in data['time_based']
        assert 'Quarterly' in data['time_based']
        assert 'Yearly' in data['time_based']

        # Verify lifestyle types
        assert 'Fitness' in data['lifestyle']
        assert 'Health' in data['lifestyle']
        assert 'Learning' in data['lifestyle']
        assert 'Personal' in data['lifestyle']

        # all_preset should be combination
        assert len(data['all_preset']) == len(data['time_based']) + len(data['lifestyle'])


@pytest.mark.integration
class TestUnifiedGoalsAPI:
    """Test /api/goals CRUD operations."""

    def test_create_goal_with_dates(self, client: TestClient):
        """Test POST /api/goals/ with start and end dates."""
        response = client.post(
            '/api/goals/',
            json={
                'name': 'Q4 Sprint',
                'goal_type': 'Sprint',
                'text': 'Complete testing suite',
                'start_date': '2025-11-01',
                'end_date': '2025-11-14',
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data['name'] == 'Q4 Sprint'
        assert data['goal_type'] == 'Sprint'
        assert data['text'] == 'Complete testing suite'
        assert data['start_date'] == '2025-11-01'
        assert data['end_date'] == '2025-11-14'
        assert data['is_completed'] is False
        assert data['is_visible'] is True
        assert 'id' in data
        assert 'created_at' in data
        assert 'days_remaining' in data

    def test_create_lifestyle_goal_with_dates(self, client: TestClient):
        """Test creating a lifestyle goal with date range."""
        response = client.post(
            '/api/goals/',
            json={
                'name': 'Daily Exercise',
                'goal_type': 'Fitness',
                'text': 'Exercise for 30 minutes every day',
                'start_date': '2025-01-01',
                'end_date': '2025-12-31',
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data['name'] == 'Daily Exercise'
        assert data['goal_type'] == 'Fitness'
        assert data['start_date'] == '2025-01-01'
        assert data['end_date'] == '2025-12-31'

    def test_create_goal_with_custom_type(self, client: TestClient):
        """Test creating a goal with custom type."""
        response = client.post(
            '/api/goals/',
            json={
                'name': 'Side Project',
                'goal_type': 'Custom:SideProject',
                'text': 'Build a cool app',
                'start_date': '2025-12-01',
                'end_date': '2025-12-31',
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data['goal_type'] == 'Custom:SideProject'

    def test_create_goal_invalid_date_range(self, client: TestClient):
        """Test POST /api/goals/ with end_date before start_date returns 400."""
        response = client.post(
            '/api/goals/',
            json={
                'name': 'Invalid Goal',
                'goal_type': 'Sprint',
                'text': 'Invalid dates',
                'start_date': '2025-11-14',
                'end_date': '2025-11-01',  # Before start_date
            },
        )

        assert response.status_code == 400
        assert 'end_date must be after' in response.json()['detail']

    def test_create_goal_with_status_text(self, client: TestClient):
        """Test creating goal with status text badge."""
        response = client.post(
            '/api/goals/',
            json={
                'name': 'Workout Goal',
                'goal_type': 'Fitness',
                'text': '10 workouts this month',
                'status_text': '3/10 completed',
                'start_date': '2025-11-01',
                'end_date': '2025-11-30',
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data['status_text'] == '3/10 completed'

    def test_create_goal_with_end_time(self, client: TestClient):
        """Test creating goal with end time."""
        response = client.post(
            '/api/goals/',
            json={
                'name': 'Daily Focus',
                'goal_type': 'Daily',
                'text': 'Complete daily tasks',
                'start_date': '2025-11-01',
                'end_date': '2025-11-01',
                'end_time': '17:00',
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data['end_time'] == '17:00'

    def test_get_all_goals(self, client: TestClient):
        """Test GET /api/goals/ returns all visible goals."""
        # Create multiple goals
        for i in range(3):
            client.post(
                '/api/goals/',
                json={
                    'name': f'Goal {i}',
                    'goal_type': 'Personal',
                    'text': f'Goal text {i}',
                    'start_date': '2025-11-01',
                    'end_date': '2025-11-30',
                },
            )

        response = client.get('/api/goals/')

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3

    def test_get_all_goals_include_hidden(self, client: TestClient):
        """Test GET /api/goals/?include_hidden=true includes hidden goals."""
        # Create a visible goal
        client.post(
            '/api/goals/',
            json={
                'name': 'Visible Goal',
                'goal_type': 'Personal',
                'text': 'Visible',
                'is_visible': True,
                'start_date': '2025-11-01',
                'end_date': '2025-11-30',
            },
        )

        # Create a hidden goal
        client.post(
            '/api/goals/',
            json={
                'name': 'Hidden Goal',
                'goal_type': 'Personal',
                'text': 'Hidden',
                'is_visible': False,
                'start_date': '2025-11-01',
                'end_date': '2025-11-30',
            },
        )

        # Default excludes hidden
        default_response = client.get('/api/goals/')
        visible_names = [g['name'] for g in default_response.json()]
        assert 'Visible Goal' in visible_names
        assert 'Hidden Goal' not in visible_names

        # With include_hidden=true
        hidden_response = client.get('/api/goals/?include_hidden=true')
        all_names = [g['name'] for g in hidden_response.json()]
        assert 'Hidden Goal' in all_names

    def test_get_goal_by_id(self, client: TestClient):
        """Test GET /api/goals/{id} returns specific goal."""
        # Create a goal
        create_response = client.post(
            '/api/goals/',
            json={
                'name': 'Specific Goal',
                'goal_type': 'Personal',
                'text': 'Find me',
                'start_date': '2025-11-01',
                'end_date': '2025-11-30',
            },
        )
        goal_id = create_response.json()['id']

        # Get by ID
        response = client.get(f'/api/goals/{goal_id}')

        assert response.status_code == 200
        data = response.json()
        assert data['id'] == goal_id
        assert data['name'] == 'Specific Goal'

    def test_get_goal_not_found(self, client: TestClient):
        """Test GET /api/goals/{id} with non-existent ID returns 404."""
        response = client.get('/api/goals/99999')

        assert response.status_code == 404
        assert 'not found' in response.json()['detail']

    def test_update_goal_text(self, client: TestClient):
        """Test PUT /api/goals/{id} updates goal text."""
        # Create goal
        create_response = client.post(
            '/api/goals/',
            json={
                'name': 'Original Name',
                'goal_type': 'Personal',
                'text': 'Original text',
                'start_date': '2025-11-01',
                'end_date': '2025-11-30',
            },
        )
        goal_id = create_response.json()['id']

        # Update
        response = client.put(f'/api/goals/{goal_id}', json={'name': 'Updated Name', 'text': 'Updated text'})

        assert response.status_code == 200
        data = response.json()
        assert data['name'] == 'Updated Name'
        assert data['text'] == 'Updated text'

    def test_update_goal_dates(self, client: TestClient):
        """Test PUT /api/goals/{id} updates goal dates."""
        # Create goal
        create_response = client.post(
            '/api/goals/',
            json={
                'name': 'Date Goal',
                'goal_type': 'Sprint',
                'text': 'Sprint',
                'start_date': '2025-11-01',
                'end_date': '2025-11-14',
            },
        )
        goal_id = create_response.json()['id']

        # Update dates
        response = client.put(f'/api/goals/{goal_id}', json={'start_date': '2025-11-05', 'end_date': '2025-11-20'})

        assert response.status_code == 200
        data = response.json()
        assert data['start_date'] == '2025-11-05'
        assert data['end_date'] == '2025-11-20'

    def test_update_goal_not_found(self, client: TestClient):
        """Test PUT /api/goals/{id} with non-existent ID returns 404."""
        response = client.put('/api/goals/99999', json={'text': 'Updated'})

        assert response.status_code == 404

    def test_delete_goal_success(self, client: TestClient):
        """Test DELETE /api/goals/{id} deletes goal."""
        # Create goal
        create_response = client.post(
            '/api/goals/',
            json={
                'name': 'To Delete',
                'goal_type': 'Personal',
                'text': 'Delete me',
                'start_date': '2025-11-01',
                'end_date': '2025-11-30',
            },
        )
        goal_id = create_response.json()['id']

        # Delete
        response = client.delete(f'/api/goals/{goal_id}')

        assert response.status_code == 200
        assert 'deleted successfully' in response.json()['message']

        # Verify gone
        get_response = client.get(f'/api/goals/{goal_id}')
        assert get_response.status_code == 404

    def test_delete_goal_not_found(self, client: TestClient):
        """Test DELETE /api/goals/{id} with non-existent ID returns 404."""
        response = client.delete('/api/goals/99999')

        assert response.status_code == 404


@pytest.mark.integration
class TestGoalToggleAPI:
    """Test goal toggle endpoints."""

    def test_toggle_complete(self, client: TestClient):
        """Test POST /api/goals/{id}/toggle-complete toggles completion."""
        # Create goal
        create_response = client.post(
            '/api/goals/',
            json={
                'name': 'Toggle Goal',
                'goal_type': 'Personal',
                'text': 'Toggle me',
                'start_date': '2025-11-01',
                'end_date': '2025-11-30',
            },
        )
        goal_id = create_response.json()['id']
        assert create_response.json()['is_completed'] is False

        # Toggle to complete
        toggle_response = client.post(f'/api/goals/{goal_id}/toggle-complete')

        assert toggle_response.status_code == 200
        data = toggle_response.json()
        assert data['is_completed'] is True
        assert data['completed_at'] is not None

        # Toggle back to incomplete
        toggle_back = client.post(f'/api/goals/{goal_id}/toggle-complete')

        assert toggle_back.json()['is_completed'] is False
        assert toggle_back.json()['completed_at'] is None

    def test_toggle_complete_not_found(self, client: TestClient):
        """Test toggle-complete with non-existent ID returns 404."""
        response = client.post('/api/goals/99999/toggle-complete')

        assert response.status_code == 404

    def test_toggle_visibility(self, client: TestClient):
        """Test POST /api/goals/{id}/toggle-visibility toggles visibility."""
        # Create visible goal
        create_response = client.post(
            '/api/goals/',
            json={
                'name': 'Visible Goal',
                'goal_type': 'Personal',
                'text': 'Hide me',
                'is_visible': True,
                'start_date': '2025-11-01',
                'end_date': '2025-11-30',
            },
        )
        goal_id = create_response.json()['id']
        assert create_response.json()['is_visible'] is True

        # Toggle to hidden
        toggle_response = client.post(f'/api/goals/{goal_id}/toggle-visibility')

        assert toggle_response.status_code == 200
        assert toggle_response.json()['is_visible'] is False

        # Toggle back to visible
        toggle_back = client.post(f'/api/goals/{goal_id}/toggle-visibility')

        assert toggle_back.json()['is_visible'] is True

    def test_toggle_visibility_not_found(self, client: TestClient):
        """Test toggle-visibility with non-existent ID returns 404."""
        response = client.post('/api/goals/99999/toggle-visibility')

        assert response.status_code == 404


@pytest.mark.integration
class TestGoalActiveDateAPI:
    """Test /api/goals/active/{date} endpoint."""

    def test_get_active_goals_within_range(self, client: TestClient):
        """Test GET /api/goals/active/{date} returns goals active on date."""
        # Create goal with date range
        client.post(
            '/api/goals/',
            json={
                'name': 'November Goal',
                'goal_type': 'Sprint',
                'text': 'Active in November',
                'start_date': '2025-11-01',
                'end_date': '2025-11-14',
            },
        )

        # Query within range
        response = client.get('/api/goals/active/2025-11-07')

        assert response.status_code == 200
        data = response.json()
        names = [g['name'] for g in data]
        assert 'November Goal' in names

    def test_get_active_goals_outside_range(self, client: TestClient):
        """Test GET /api/goals/active/{date} excludes goals outside range."""
        # Create goal with specific range
        client.post(
            '/api/goals/',
            json={
                'name': 'December Goal',
                'goal_type': 'Sprint',
                'text': 'Only in December',
                'start_date': '2025-12-01',
                'end_date': '2025-12-14',
            },
        )

        # Query for November (outside December range)
        response = client.get('/api/goals/active/2025-11-15')

        assert response.status_code == 200
        names = [g['name'] for g in response.json()]
        assert 'December Goal' not in names

    def test_get_active_goals_lifestyle_with_wide_range(self, client: TestClient):
        """Test lifestyle goals with wide date range are returned for dates within range."""
        # Create lifestyle goal with full-year date range
        client.post(
            '/api/goals/',
            json={
                'name': 'Ongoing Fitness',
                'goal_type': 'Fitness',
                'text': 'Year-long fitness goal',
                'start_date': '2025-01-01',
                'end_date': '2025-12-31',
            },
        )

        # Query date within range
        response = client.get('/api/goals/active/2025-06-15')

        assert response.status_code == 200
        names = [g['name'] for g in response.json()]
        assert 'Ongoing Fitness' in names

    def test_get_active_goals_days_remaining(self, client: TestClient):
        """Test days_remaining is calculated from the query date."""
        client.post(
            '/api/goals/',
            json={
                'name': 'Countdown Goal',
                'goal_type': 'Sprint',
                'text': 'Test countdown',
                'start_date': '2025-11-01',
                'end_date': '2025-11-14',
            },
        )

        # Query from Nov 7 - should show 7 days remaining
        response = client.get('/api/goals/active/2025-11-07')

        assert response.status_code == 200
        goal = next(g for g in response.json() if g['name'] == 'Countdown Goal')
        assert goal['days_remaining'] == 7

    def test_get_active_goals_before_and_after_start(self, client: TestClient):
        """Test goals only appear within their date range."""
        client.post(
            '/api/goals/',
            json={
                'name': 'November Goal',
                'goal_type': 'Personal',
                'text': 'Active in November only',
                'start_date': '2025-11-01',
                'end_date': '2025-11-30',
            },
        )

        # Before start - should NOT appear
        before = client.get('/api/goals/active/2025-10-15')
        before_names = [g['name'] for g in before.json()]
        assert 'November Goal' not in before_names

        # During range - should appear
        during = client.get('/api/goals/active/2025-11-15')
        during_names = [g['name'] for g in during.json()]
        assert 'November Goal' in during_names

        # After end - should NOT appear
        after = client.get('/api/goals/active/2025-12-15')
        after_names = [g['name'] for g in after.json()]
        assert 'November Goal' not in after_names


@pytest.mark.integration
class TestGoalEdgeCases:
    """Test edge cases and special scenarios."""

    def test_goal_with_very_long_text(self, client: TestClient):
        """Test creating goal with very long text."""
        long_text = 'A' * 10000
        response = client.post(
            '/api/goals/',
            json={
                'name': 'Long Goal',
                'goal_type': 'Personal',
                'text': long_text,
                'start_date': '2025-11-01',
                'end_date': '2025-11-30',
            },
        )

        assert response.status_code == 201
        assert len(response.json()['text']) == 10000

    def test_goal_empty_text_allowed(self, client: TestClient):
        """Test that empty text is accepted."""
        response = client.post(
            '/api/goals/',
            json={
                'name': 'Empty Text Goal',
                'goal_type': 'Personal',
                'text': '',
                'start_date': '2025-11-01',
                'end_date': '2025-11-30',
            },
        )

        assert response.status_code == 201
        assert response.json()['text'] == ''

    def test_goal_countdown_setting(self, client: TestClient):
        """Test show_countdown field."""
        # With countdown
        with_countdown = client.post(
            '/api/goals/',
            json={
                'name': 'Countdown Goal',
                'goal_type': 'Sprint',
                'text': 'With countdown',
                'start_date': '2025-11-01',
                'end_date': '2025-11-14',
                'show_countdown': True,
            },
        )
        assert with_countdown.json()['show_countdown'] is True

        # Without countdown
        without_countdown = client.post(
            '/api/goals/',
            json={
                'name': 'No Countdown Goal',
                'goal_type': 'Fitness',
                'text': 'Without countdown',
                'start_date': '2025-11-01',
                'end_date': '2025-11-30',
                'show_countdown': False,
            },
        )
        assert without_countdown.json()['show_countdown'] is False

    def test_goal_same_start_end_date(self, client: TestClient):
        """Test creating goal with same start and end date (single day goal)."""
        response = client.post(
            '/api/goals/',
            json={
                'name': 'Single Day',
                'goal_type': 'Daily',
                'text': 'One day only',
                'start_date': '2025-11-15',
                'end_date': '2025-11-15',
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data['start_date'] == data['end_date']

    def test_multiple_goal_types_coexist(self, client: TestClient):
        """Test that different goal types can coexist."""
        types = ['Sprint', 'Quarterly', 'Fitness', 'Personal', 'Custom:MyType']
        created_ids = []

        for goal_type in types:
            resp = client.post(
                '/api/goals/',
                json={
                    'name': f'{goal_type} Goal',
                    'goal_type': goal_type,
                    'text': f'Goal of type {goal_type}',
                    'start_date': '2025-11-01',
                    'end_date': '2025-11-30',
                },
            )
            assert resp.status_code == 201
            created_ids.append(resp.json()['id'])

        # All should be retrievable
        for goal_id in created_ids:
            get_resp = client.get(f'/api/goals/{goal_id}')
            assert get_resp.status_code == 200
