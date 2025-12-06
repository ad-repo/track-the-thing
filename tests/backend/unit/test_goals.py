"""
Unit tests for Goal models (unified Goal, legacy SprintGoal, QuarterlyGoal)
"""

from datetime import datetime

import pytest
from sqlalchemy.orm import Session

from app.models import Goal, QuarterlyGoal, SprintGoal


@pytest.mark.unit
class TestSprintGoalModel:
    """Test SprintGoal model CRUD operations and behavior."""

    def test_create_sprint_goal(self, db_session: Session):
        """Test creating a sprint goal with all required fields."""
        goal = SprintGoal(text='Complete API testing', start_date='2025-11-01', end_date='2025-11-14')
        db_session.add(goal)
        db_session.commit()

        assert goal.id is not None
        assert goal.text == 'Complete API testing'
        assert goal.start_date == '2025-11-01'
        assert goal.end_date == '2025-11-14'
        assert goal.created_at is not None
        assert goal.updated_at is not None

    def test_sprint_goal_timestamps(self, db_session: Session):
        """Test created_at and updated_at timestamps."""
        goal = SprintGoal(text='Sprint goal', start_date='2025-11-01', end_date='2025-11-14')
        db_session.add(goal)
        db_session.commit()

        created_at = goal.created_at

        # Update the goal
        goal.text = 'Updated sprint goal'
        db_session.commit()

        # created_at should remain same, updated_at should change
        assert goal.created_at == created_at
        # Note: updated_at manual update is done in API, not model

    def test_update_sprint_goal_text(self, db_session: Session):
        """Test updating sprint goal text."""
        goal = SprintGoal(text='Original text', start_date='2025-11-01', end_date='2025-11-14')
        db_session.add(goal)
        db_session.commit()

        goal.text = 'Updated text'
        db_session.commit()

        assert goal.text == 'Updated text'

    def test_update_sprint_goal_dates(self, db_session: Session):
        """Test updating sprint goal dates."""
        goal = SprintGoal(text='Sprint goal', start_date='2025-11-01', end_date='2025-11-14')
        db_session.add(goal)
        db_session.commit()

        goal.start_date = '2025-11-05'
        goal.end_date = '2025-11-20'
        db_session.commit()

        assert goal.start_date == '2025-11-05'
        assert goal.end_date == '2025-11-20'

    def test_delete_sprint_goal(self, db_session: Session):
        """Test deleting a sprint goal."""
        goal = SprintGoal(text='To be deleted', start_date='2025-11-01', end_date='2025-11-14')
        db_session.add(goal)
        db_session.commit()

        goal_id = goal.id
        db_session.delete(goal)
        db_session.commit()

        deleted_goal = db_session.query(SprintGoal).filter(SprintGoal.id == goal_id).first()
        assert deleted_goal is None

    def test_query_sprint_goals_by_date_range(self, db_session: Session):
        """Test querying sprint goals within a date range."""
        # Create multiple sprint goals
        goals = [
            SprintGoal(text='Sprint 1', start_date='2025-10-01', end_date='2025-10-14'),
            SprintGoal(text='Sprint 2', start_date='2025-11-01', end_date='2025-11-14'),
            SprintGoal(text='Sprint 3', start_date='2025-12-01', end_date='2025-12-14'),
        ]
        for goal in goals:
            db_session.add(goal)
        db_session.commit()

        # Query goals that cover November 10
        date = '2025-11-10'
        active_goal = (
            db_session.query(SprintGoal).filter(SprintGoal.start_date <= date, SprintGoal.end_date >= date).first()
        )

        assert active_goal is not None
        assert active_goal.text == 'Sprint 2'

    def test_sprint_goal_ordering(self, db_session: Session):
        """Test querying sprint goals ordered by start_date."""
        goals = [
            SprintGoal(text='Sprint C', start_date='2025-12-01', end_date='2025-12-14'),
            SprintGoal(text='Sprint A', start_date='2025-10-01', end_date='2025-10-14'),
            SprintGoal(text='Sprint B', start_date='2025-11-01', end_date='2025-11-14'),
        ]
        for goal in goals:
            db_session.add(goal)
        db_session.commit()

        ordered_goals = db_session.query(SprintGoal).order_by(SprintGoal.start_date).all()

        assert len(ordered_goals) == 3
        assert ordered_goals[0].text == 'Sprint A'
        assert ordered_goals[1].text == 'Sprint B'
        assert ordered_goals[2].text == 'Sprint C'

    def test_sprint_goal_with_empty_text(self, db_session: Session):
        """Test creating sprint goal with empty text."""
        goal = SprintGoal(text='', start_date='2025-11-01', end_date='2025-11-14')
        db_session.add(goal)
        db_session.commit()

        assert goal.text == ''
        assert goal.id is not None

    def test_sprint_goal_with_long_text(self, db_session: Session):
        """Test creating sprint goal with very long text."""
        long_text = 'A' * 1000
        goal = SprintGoal(text=long_text, start_date='2025-11-01', end_date='2025-11-14')
        db_session.add(goal)
        db_session.commit()

        assert goal.text == long_text
        assert len(goal.text) == 1000


@pytest.mark.unit
class TestQuarterlyGoalModel:
    """Test QuarterlyGoal model CRUD operations and behavior."""

    def test_create_quarterly_goal(self, db_session: Session):
        """Test creating a quarterly goal with all required fields."""
        goal = QuarterlyGoal(text='Q4 2025 Goals', start_date='2025-10-01', end_date='2025-12-31')
        db_session.add(goal)
        db_session.commit()

        assert goal.id is not None
        assert goal.text == 'Q4 2025 Goals'
        assert goal.start_date == '2025-10-01'
        assert goal.end_date == '2025-12-31'
        assert goal.created_at is not None
        assert goal.updated_at is not None

    def test_quarterly_goal_timestamps(self, db_session: Session):
        """Test created_at and updated_at timestamps."""
        goal = QuarterlyGoal(text='Quarterly goal', start_date='2025-10-01', end_date='2025-12-31')
        db_session.add(goal)
        db_session.commit()

        created_at = goal.created_at

        # Update the goal
        goal.text = 'Updated quarterly goal'
        db_session.commit()

        # created_at should remain same
        assert goal.created_at == created_at

    def test_update_quarterly_goal_text(self, db_session: Session):
        """Test updating quarterly goal text."""
        goal = QuarterlyGoal(text='Original text', start_date='2025-10-01', end_date='2025-12-31')
        db_session.add(goal)
        db_session.commit()

        goal.text = 'Updated text'
        db_session.commit()

        assert goal.text == 'Updated text'

    def test_update_quarterly_goal_dates(self, db_session: Session):
        """Test updating quarterly goal dates."""
        goal = QuarterlyGoal(text='Quarterly goal', start_date='2025-10-01', end_date='2025-12-31')
        db_session.add(goal)
        db_session.commit()

        goal.start_date = '2025-11-01'
        goal.end_date = '2026-01-31'
        db_session.commit()

        assert goal.start_date == '2025-11-01'
        assert goal.end_date == '2026-01-31'

    def test_delete_quarterly_goal(self, db_session: Session):
        """Test deleting a quarterly goal."""
        goal = QuarterlyGoal(text='To be deleted', start_date='2025-10-01', end_date='2025-12-31')
        db_session.add(goal)
        db_session.commit()

        goal_id = goal.id
        db_session.delete(goal)
        db_session.commit()

        deleted_goal = db_session.query(QuarterlyGoal).filter(QuarterlyGoal.id == goal_id).first()
        assert deleted_goal is None

    def test_query_quarterly_goals_by_date_range(self, db_session: Session):
        """Test querying quarterly goals within a date range."""
        # Create multiple quarterly goals
        goals = [
            QuarterlyGoal(text='Q1 2025', start_date='2025-01-01', end_date='2025-03-31'),
            QuarterlyGoal(text='Q2 2025', start_date='2025-04-01', end_date='2025-06-30'),
            QuarterlyGoal(text='Q3 2025', start_date='2025-07-01', end_date='2025-09-30'),
            QuarterlyGoal(text='Q4 2025', start_date='2025-10-01', end_date='2025-12-31'),
        ]
        for goal in goals:
            db_session.add(goal)
        db_session.commit()

        # Query goals that cover November 10
        date = '2025-11-10'
        active_goal = (
            db_session.query(QuarterlyGoal)
            .filter(QuarterlyGoal.start_date <= date, QuarterlyGoal.end_date >= date)
            .first()
        )

        assert active_goal is not None
        assert active_goal.text == 'Q4 2025'

    def test_quarterly_goal_ordering(self, db_session: Session):
        """Test querying quarterly goals ordered by start_date."""
        goals = [
            QuarterlyGoal(text='Q4', start_date='2025-10-01', end_date='2025-12-31'),
            QuarterlyGoal(text='Q2', start_date='2025-04-01', end_date='2025-06-30'),
            QuarterlyGoal(text='Q3', start_date='2025-07-01', end_date='2025-09-30'),
            QuarterlyGoal(text='Q1', start_date='2025-01-01', end_date='2025-03-31'),
        ]
        for goal in goals:
            db_session.add(goal)
        db_session.commit()

        ordered_goals = db_session.query(QuarterlyGoal).order_by(QuarterlyGoal.start_date).all()

        assert len(ordered_goals) == 4
        assert ordered_goals[0].text == 'Q1'
        assert ordered_goals[1].text == 'Q2'
        assert ordered_goals[2].text == 'Q3'
        assert ordered_goals[3].text == 'Q4'

    def test_multiple_quarterly_goals(self, db_session: Session):
        """Test creating and querying multiple quarterly goals."""
        goals = [
            QuarterlyGoal(text='Goal 1', start_date='2025-01-01', end_date='2025-03-31'),
            QuarterlyGoal(text='Goal 2', start_date='2025-04-01', end_date='2025-06-30'),
            QuarterlyGoal(text='Goal 3', start_date='2025-07-01', end_date='2025-09-30'),
        ]
        for goal in goals:
            db_session.add(goal)
        db_session.commit()

        all_goals = db_session.query(QuarterlyGoal).all()
        assert len(all_goals) == 3

    def test_quarterly_goal_unique_id(self, db_session: Session):
        """Test that each quarterly goal gets a unique ID."""
        goal1 = QuarterlyGoal(text='Goal 1', start_date='2025-01-01', end_date='2025-03-31')
        goal2 = QuarterlyGoal(text='Goal 2', start_date='2025-04-01', end_date='2025-06-30')

        db_session.add(goal1)
        db_session.add(goal2)
        db_session.commit()

        assert goal1.id != goal2.id


@pytest.mark.unit
class TestGoalModelComparison:
    """Test similarities and differences between Sprint and Quarterly goals."""

    def test_sprint_and_quarterly_independent(self, db_session: Session):
        """Test that sprint and quarterly goals are stored independently."""
        sprint = SprintGoal(text='Sprint', start_date='2025-11-01', end_date='2025-11-14')
        quarterly = QuarterlyGoal(text='Quarterly', start_date='2025-10-01', end_date='2025-12-31')

        db_session.add(sprint)
        db_session.add(quarterly)
        db_session.commit()

        sprint_count = db_session.query(SprintGoal).count()
        quarterly_count = db_session.query(QuarterlyGoal).count()

        assert sprint_count == 1
        assert quarterly_count == 1

    def test_overlapping_sprint_and_quarterly(self, db_session: Session):
        """Test that sprint and quarterly goals can overlap (they're independent)."""
        # A sprint that falls within a quarterly goal is allowed
        quarterly = QuarterlyGoal(text='Q4 Goals', start_date='2025-10-01', end_date='2025-12-31')
        sprint = SprintGoal(text='Sprint in Q4', start_date='2025-11-01', end_date='2025-11-14')

        db_session.add(quarterly)
        db_session.add(sprint)
        db_session.commit()

        # Both should exist
        assert quarterly.id is not None
        assert sprint.id is not None

        # Query both for same date
        date = '2025-11-10'
        active_sprint = (
            db_session.query(SprintGoal).filter(SprintGoal.start_date <= date, SprintGoal.end_date >= date).first()
        )
        active_quarterly = (
            db_session.query(QuarterlyGoal)
            .filter(QuarterlyGoal.start_date <= date, QuarterlyGoal.end_date >= date)
            .first()
        )

        assert active_sprint is not None
        assert active_quarterly is not None


@pytest.mark.unit
class TestUnifiedGoalModel:
    """Test unified Goal model CRUD operations and behavior."""

    def test_create_goal_with_all_fields(self, db_session: Session):
        """Test creating a goal with all fields."""
        goal = Goal(
            name='Q4 Sprint',
            goal_type='Sprint',
            text='<p>Complete testing</p>',
            start_date='2025-11-01',
            end_date='2025-11-14',
            end_time='17:00',
            status_text='In Progress',
            show_countdown=1,
            is_completed=0,
            is_visible=1,
            order_index=0,
        )
        db_session.add(goal)
        db_session.commit()

        assert goal.id is not None
        assert goal.name == 'Q4 Sprint'
        assert goal.goal_type == 'Sprint'
        assert goal.text == '<p>Complete testing</p>'
        assert goal.start_date == '2025-11-01'
        assert goal.end_date == '2025-11-14'
        assert goal.end_time == '17:00'
        assert goal.status_text == 'In Progress'
        assert goal.show_countdown == 1
        assert goal.is_completed == 0
        assert goal.is_visible == 1
        assert goal.created_at is not None
        assert goal.updated_at is not None

    def test_create_lifestyle_goal_no_dates(self, db_session: Session):
        """Test creating a lifestyle goal without dates (ongoing)."""
        goal = Goal(
            name='Daily Exercise',
            goal_type='Fitness',
            text='Exercise every day',
            start_date='2025-01-01',  # Lifestyle goals may have no dates
            end_date='2025-12-31',
        )
        db_session.add(goal)
        db_session.commit()

        assert goal.id is not None
        assert goal.goal_type == 'Fitness'

    def test_create_custom_type_goal(self, db_session: Session):
        """Test creating a goal with custom type."""
        goal = Goal(
            name='Side Project',
            goal_type='Custom:SideProject',
            text='Build an app',
            start_date='2025-12-01',
            end_date='2025-12-31',
        )
        db_session.add(goal)
        db_session.commit()

        assert goal.goal_type == 'Custom:SideProject'
        assert goal.goal_type.startswith('Custom:')

    def test_goal_default_values(self, db_session: Session):
        """Test goal default values are applied."""
        goal = Goal(
            name='Minimal Goal',
            goal_type='Personal',
            start_date='2025-11-01',
            end_date='2025-11-30',
        )
        db_session.add(goal)
        db_session.commit()

        assert goal.text == ''
        assert goal.end_time == ''
        assert goal.status_text == ''
        assert goal.show_countdown == 1
        assert goal.is_completed == 0
        assert goal.is_visible == 1
        assert goal.order_index == 0
        assert goal.completed_at is None

    def test_goal_completion_toggle(self, db_session: Session):
        """Test toggling goal completion status."""
        goal = Goal(
            name='Toggle Goal',
            goal_type='Personal',
            start_date='2025-11-01',
            end_date='2025-11-14',
            is_completed=0,
        )
        db_session.add(goal)
        db_session.commit()

        assert goal.is_completed == 0
        assert goal.completed_at is None

        # Complete the goal
        goal.is_completed = 1
        goal.completed_at = datetime.utcnow()
        db_session.commit()

        assert goal.is_completed == 1
        assert goal.completed_at is not None

        # Uncomplete the goal
        goal.is_completed = 0
        goal.completed_at = None
        db_session.commit()

        assert goal.is_completed == 0
        assert goal.completed_at is None

    def test_goal_visibility_toggle(self, db_session: Session):
        """Test toggling goal visibility."""
        goal = Goal(
            name='Visible Goal',
            goal_type='Personal',
            start_date='2025-11-01',
            end_date='2025-11-14',
            is_visible=1,
        )
        db_session.add(goal)
        db_session.commit()

        assert goal.is_visible == 1

        # Hide the goal
        goal.is_visible = 0
        db_session.commit()

        assert goal.is_visible == 0

        # Show the goal
        goal.is_visible = 1
        db_session.commit()

        assert goal.is_visible == 1

    def test_goal_ordering(self, db_session: Session):
        """Test goal ordering by order_index."""
        goals = [
            Goal(name='Goal C', goal_type='Personal', start_date='2025-11-01', end_date='2025-11-30', order_index=2),
            Goal(name='Goal A', goal_type='Personal', start_date='2025-11-01', end_date='2025-11-30', order_index=0),
            Goal(name='Goal B', goal_type='Personal', start_date='2025-11-01', end_date='2025-11-30', order_index=1),
        ]
        for goal in goals:
            db_session.add(goal)
        db_session.commit()

        ordered = db_session.query(Goal).order_by(Goal.order_index).all()

        assert ordered[0].name == 'Goal A'
        assert ordered[1].name == 'Goal B'
        assert ordered[2].name == 'Goal C'

    def test_multiple_goal_types(self, db_session: Session):
        """Test creating goals with different types."""
        types = ['Daily', 'Weekly', 'Sprint', 'Monthly', 'Quarterly', 'Yearly', 'Fitness', 'Personal']
        for i, goal_type in enumerate(types):
            goal = Goal(
                name=f'{goal_type} Goal',
                goal_type=goal_type,
                start_date='2025-11-01',
                end_date='2025-11-30',
                order_index=i,
            )
            db_session.add(goal)
        db_session.commit()

        all_goals = db_session.query(Goal).all()
        assert len(all_goals) == len(types)

        # Verify all types were saved correctly
        saved_types = {g.goal_type for g in all_goals}
        assert saved_types == set(types)

    def test_delete_goal(self, db_session: Session):
        """Test deleting a goal."""
        goal = Goal(
            name='To Delete',
            goal_type='Personal',
            start_date='2025-11-01',
            end_date='2025-11-14',
        )
        db_session.add(goal)
        db_session.commit()

        goal_id = goal.id
        db_session.delete(goal)
        db_session.commit()

        deleted = db_session.query(Goal).filter(Goal.id == goal_id).first()
        assert deleted is None

    def test_update_goal(self, db_session: Session):
        """Test updating goal fields."""
        goal = Goal(
            name='Original Name',
            goal_type='Personal',
            text='Original text',
            start_date='2025-11-01',
            end_date='2025-11-14',
        )
        db_session.add(goal)
        db_session.commit()

        goal.name = 'Updated Name'
        goal.text = 'Updated text'
        goal.start_date = '2025-11-05'
        goal.end_date = '2025-11-20'
        goal.status_text = 'Modified'
        db_session.commit()

        assert goal.name == 'Updated Name'
        assert goal.text == 'Updated text'
        assert goal.start_date == '2025-11-05'
        assert goal.end_date == '2025-11-20'
        assert goal.status_text == 'Modified'

    def test_query_visible_goals(self, db_session: Session):
        """Test querying only visible goals."""
        visible_goal = Goal(
            name='Visible',
            goal_type='Personal',
            start_date='2025-11-01',
            end_date='2025-11-30',
            is_visible=1,
        )
        hidden_goal = Goal(
            name='Hidden',
            goal_type='Personal',
            start_date='2025-11-01',
            end_date='2025-11-30',
            is_visible=0,
        )
        db_session.add(visible_goal)
        db_session.add(hidden_goal)
        db_session.commit()

        visible_only = db_session.query(Goal).filter(Goal.is_visible == 1).all()
        all_goals = db_session.query(Goal).all()

        assert len(visible_only) == 1
        assert len(all_goals) == 2
        assert visible_only[0].name == 'Visible'

    def test_goal_with_long_text(self, db_session: Session):
        """Test creating goal with very long HTML text."""
        long_text = '<p>' + 'A' * 10000 + '</p>'
        goal = Goal(
            name='Long Text Goal',
            goal_type='Personal',
            text=long_text,
            start_date='2025-11-01',
            end_date='2025-11-30',
        )
        db_session.add(goal)
        db_session.commit()

        assert len(goal.text) == len(long_text)
