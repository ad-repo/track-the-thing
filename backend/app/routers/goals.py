"""
API routes for unified goals system

Supports multiple goal types:
- Time-based: Daily, Weekly, Sprint, Monthly, Quarterly, Yearly
- Lifestyle: Fitness, Health, Learning, Personal, Financial, Habits, Career, Relationships, Creativity
- Custom: User-defined types stored as "Custom:TypeName"
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix='/api/goals', tags=['goals'])

# Goal type constants
TIME_BASED_TYPES = ['Daily', 'Weekly', 'Sprint', 'Monthly', 'Quarterly', 'Yearly']
LIFESTYLE_TYPES = [
    'Fitness',
    'Health',
    'Learning',
    'Personal',
    'Financial',
    'Habits',
    'Career',
    'Relationships',
    'Creativity',
]
ALL_PRESET_TYPES = TIME_BASED_TYPES + LIFESTYLE_TYPES


def calculate_days_remaining(end_date_str: str | None, from_date_str: str) -> int | None:
    """Calculate days remaining from a specific date to the end date."""
    if not end_date_str:
        return None
    try:
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
        return (end_date - from_date).days
    except Exception:
        return None


def _goal_to_response(goal, from_date: str = None) -> dict:
    """Convert goal model to response dict with calculated fields."""
    if from_date is None:
        from_date = datetime.now().strftime('%Y-%m-%d')

    return {
        'id': goal.id,
        'name': goal.name,
        'goal_type': goal.goal_type,
        'text': goal.text,
        'start_date': goal.start_date,
        'end_date': goal.end_date,
        'end_time': goal.end_time or '',
        'status_text': goal.status_text or '',
        'show_countdown': bool(goal.show_countdown),
        'is_completed': bool(goal.is_completed),
        'completed_at': goal.completed_at,
        'is_visible': bool(goal.is_visible),
        'order_index': goal.order_index,
        'created_at': goal.created_at,
        'updated_at': goal.updated_at,
        'days_remaining': calculate_days_remaining(goal.end_date, from_date),
    }


# =====================
# Unified Goals API
# =====================


@router.get('/types')
def get_goal_types():
    """Return available goal types for the dropdown."""
    return {'time_based': TIME_BASED_TYPES, 'lifestyle': LIFESTYLE_TYPES, 'all_preset': ALL_PRESET_TYPES}


@router.get('/', response_model=list[schemas.UnifiedGoalResponse])
def get_all_goals(include_hidden: bool = False, db: Session = Depends(get_db)):
    """Get all goals, optionally including hidden ones."""
    query = db.query(models.Goal).order_by(models.Goal.order_index)
    if not include_hidden:
        query = query.filter(models.Goal.is_visible == 1)
    goals = query.all()
    return [_goal_to_response(g) for g in goals]


@router.get('/active/{date}', response_model=list[schemas.UnifiedGoalResponse])
def get_active_goals_for_date(date: str, db: Session = Depends(get_db)):
    """Get all visible goals active for a specific date.

    Logic:
    - Both dates set: show if date is within start_date and end_date range
    - Only start_date set: show if date >= start_date (ongoing goal)
    - Only end_date set: show if date <= end_date (goal with deadline, no start)
    - No dates (lifestyle): always show if visible
    """
    from sqlalchemy import and_, or_

    goals = (
        db.query(models.Goal)
        .filter(
            models.Goal.is_visible == 1,
            or_(
                # Both dates set: check full date range
                and_(
                    models.Goal.start_date.isnot(None),
                    models.Goal.end_date.isnot(None),
                    models.Goal.start_date <= date,
                    models.Goal.end_date >= date,
                ),
                # Only start_date set (ongoing goal): show if date >= start_date
                and_(
                    models.Goal.start_date.isnot(None),
                    models.Goal.end_date.is_(None),
                    models.Goal.start_date <= date,
                ),
                # Only end_date set (deadline goal): show if date <= end_date
                and_(
                    models.Goal.start_date.is_(None),
                    models.Goal.end_date.isnot(None),
                    models.Goal.end_date >= date,
                ),
                # No dates (lifestyle): always show
                and_(
                    models.Goal.start_date.is_(None),
                    models.Goal.end_date.is_(None),
                ),
            ),
        )
        .order_by(models.Goal.order_index)
        .all()
    )

    return [_goal_to_response(g, date) for g in goals]


@router.get('/{goal_id}', response_model=schemas.UnifiedGoalResponse)
def get_goal(goal_id: int, db: Session = Depends(get_db)):
    """Get a specific goal by ID."""
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail='Goal not found')
    return _goal_to_response(goal)


@router.post('/', response_model=schemas.UnifiedGoalResponse, status_code=201)
def create_goal(goal: schemas.UnifiedGoalCreate, db: Session = Depends(get_db)):
    """Create a new goal."""
    # Validate dates (only when both are provided)
    if goal.start_date and goal.end_date and goal.end_date < goal.start_date:
        raise HTTPException(status_code=400, detail='end_date must be after or equal to start_date')

    db_goal = models.Goal(
        name=goal.name,
        goal_type=goal.goal_type,
        text=goal.text,
        start_date=goal.start_date,
        end_date=goal.end_date,
        end_time=goal.end_time,
        status_text=goal.status_text,
        show_countdown=1 if goal.show_countdown else 0,
        is_visible=1 if goal.is_visible else 0,
        order_index=goal.order_index,
    )
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return _goal_to_response(db_goal)


@router.put('/{goal_id}', response_model=schemas.UnifiedGoalResponse)
def update_goal(goal_id: int, goal_update: schemas.UnifiedGoalUpdate, db: Session = Depends(get_db)):
    """Update a goal."""
    db_goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail='Goal not found')

    update_data = goal_update.model_dump(exclude_unset=True)

    # Handle completion
    if 'is_completed' in update_data:
        if update_data['is_completed'] and not db_goal.is_completed:
            db_goal.completed_at = datetime.utcnow()
        elif not update_data['is_completed']:
            db_goal.completed_at = None
        db_goal.is_completed = 1 if update_data['is_completed'] else 0
        del update_data['is_completed']

    # Handle booleans stored as integers
    for bool_field in ['show_countdown', 'is_visible']:
        if bool_field in update_data:
            update_data[bool_field] = 1 if update_data[bool_field] else 0

    for key, value in update_data.items():
        setattr(db_goal, key, value)

    db_goal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_goal)
    return _goal_to_response(db_goal)


@router.post('/{goal_id}/toggle-complete', response_model=schemas.UnifiedGoalResponse)
def toggle_goal_complete(goal_id: int, db: Session = Depends(get_db)):
    """Toggle goal completion status."""
    db_goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail='Goal not found')

    if db_goal.is_completed:
        db_goal.is_completed = 0
        db_goal.completed_at = None
    else:
        db_goal.is_completed = 1
        db_goal.completed_at = datetime.utcnow()

    db_goal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_goal)
    return _goal_to_response(db_goal)


@router.post('/{goal_id}/toggle-visibility', response_model=schemas.UnifiedGoalResponse)
def toggle_goal_visibility(goal_id: int, db: Session = Depends(get_db)):
    """Toggle goal visibility on Daily View."""
    db_goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail='Goal not found')

    db_goal.is_visible = 0 if db_goal.is_visible else 1
    db_goal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_goal)
    return _goal_to_response(db_goal)


@router.put('/reorder', status_code=200)
def reorder_goals(goals: list[dict], db: Session = Depends(get_db)):
    """Reorder goals by updating order_index."""
    for item in goals:
        db_goal = db.query(models.Goal).filter(models.Goal.id == item['id']).first()
        if db_goal:
            db_goal.order_index = item['order_index']
    db.commit()
    return {'message': 'Goals reordered successfully'}


@router.delete('/{goal_id}')
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    """Delete a goal."""
    db_goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail='Goal not found')

    db.delete(db_goal)
    db.commit()
    return {'message': 'Goal deleted successfully'}


# =====================
# Legacy Endpoints (for backward compatibility during transition)
# These are kept for existing frontend code
# =====================


def validate_date_range(start_date: str, end_date: str) -> bool:
    """Validate that end_date is after start_date."""
    try:
        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        end = datetime.strptime(end_date, '%Y-%m-%d').date()
        return end > start
    except Exception:
        return False


def _legacy_goal_to_response(goal, from_date: str = None) -> dict:
    """Convert legacy goal model to response dict."""
    if from_date is None:
        from_date = datetime.now().strftime('%Y-%m-%d')

    return {
        'id': goal.id,
        'text': goal.text,
        'start_date': goal.start_date,
        'end_date': goal.end_date,
        'created_at': goal.created_at,
        'updated_at': goal.updated_at,
        'days_remaining': calculate_days_remaining(goal.end_date, from_date),
    }


# Sprint Goal Endpoints (Legacy)


@router.get('/sprint', response_model=list[schemas.GoalResponse])
def get_all_sprint_goals(db: Session = Depends(get_db)):
    """Get all sprint goals (legacy endpoint)."""
    goals = db.query(models.SprintGoal).order_by(models.SprintGoal.start_date).all()
    return [_legacy_goal_to_response(goal) for goal in goals]


@router.get('/sprint/{date}', response_model=schemas.GoalResponse)
def get_sprint_for_date(date: str, db: Session = Depends(get_db)):
    """Get the sprint goal for a specific date (legacy endpoint)."""
    goal = (
        db.query(models.SprintGoal)
        .filter(models.SprintGoal.start_date <= date, models.SprintGoal.end_date >= date)
        .first()
    )

    if not goal:
        goal = (
            db.query(models.SprintGoal)
            .filter(models.SprintGoal.start_date > date)
            .order_by(models.SprintGoal.start_date)
            .first()
        )

    if not goal:
        raise HTTPException(status_code=404, detail='No sprint goal found for this date')

    return _legacy_goal_to_response(goal, date)


@router.post('/sprint', response_model=schemas.GoalResponse, status_code=201)
def create_sprint_goal(goal: schemas.GoalCreate, db: Session = Depends(get_db)):
    """Create a new sprint goal (legacy endpoint)."""
    if not validate_date_range(goal.start_date, goal.end_date):
        raise HTTPException(status_code=400, detail='end_date must be after start_date')

    db_goal = models.SprintGoal(text=goal.text, start_date=goal.start_date, end_date=goal.end_date)
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return _legacy_goal_to_response(db_goal)


@router.put('/sprint/{goal_id}', response_model=schemas.GoalResponse)
def update_sprint_goal(goal_id: int, goal_update: schemas.GoalUpdate, db: Session = Depends(get_db)):
    """Update a sprint goal (legacy endpoint)."""
    db_goal = db.query(models.SprintGoal).filter(models.SprintGoal.id == goal_id).first()

    if not db_goal:
        raise HTTPException(status_code=404, detail='Sprint goal not found')

    if goal_update.text is not None:
        db_goal.text = goal_update.text

    if goal_update.start_date is not None or goal_update.end_date is not None:
        new_start = goal_update.start_date if goal_update.start_date is not None else db_goal.start_date
        new_end = goal_update.end_date if goal_update.end_date is not None else db_goal.end_date

        if not validate_date_range(new_start, new_end):
            raise HTTPException(status_code=400, detail='end_date must be after start_date')

        if goal_update.start_date is not None:
            db_goal.start_date = goal_update.start_date
        if goal_update.end_date is not None:
            db_goal.end_date = goal_update.end_date

    db_goal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_goal)
    return _legacy_goal_to_response(db_goal)


@router.delete('/sprint/{goal_id}')
def delete_sprint_goal(goal_id: int, db: Session = Depends(get_db)):
    """Delete a sprint goal (legacy endpoint)."""
    db_goal = db.query(models.SprintGoal).filter(models.SprintGoal.id == goal_id).first()

    if not db_goal:
        raise HTTPException(status_code=404, detail='Sprint goal not found')

    db.delete(db_goal)
    db.commit()
    return {'message': 'Sprint goal deleted successfully'}


# Quarterly Goal Endpoints (Legacy)


@router.get('/quarterly', response_model=list[schemas.GoalResponse])
def get_all_quarterly_goals(db: Session = Depends(get_db)):
    """Get all quarterly goals (legacy endpoint)."""
    goals = db.query(models.QuarterlyGoal).order_by(models.QuarterlyGoal.start_date).all()
    return [_legacy_goal_to_response(goal) for goal in goals]


@router.get('/quarterly/{date}', response_model=schemas.GoalResponse)
def get_quarterly_for_date(date: str, db: Session = Depends(get_db)):
    """Get the quarterly goal for a specific date (legacy endpoint)."""
    goal = (
        db.query(models.QuarterlyGoal)
        .filter(models.QuarterlyGoal.start_date <= date, models.QuarterlyGoal.end_date >= date)
        .first()
    )

    if not goal:
        goal = (
            db.query(models.QuarterlyGoal)
            .filter(models.QuarterlyGoal.start_date > date)
            .order_by(models.QuarterlyGoal.start_date)
            .first()
        )

    if not goal:
        raise HTTPException(status_code=404, detail='No quarterly goal found for this date')

    return _legacy_goal_to_response(goal, date)


@router.post('/quarterly', response_model=schemas.GoalResponse, status_code=201)
def create_quarterly_goal(goal: schemas.GoalCreate, db: Session = Depends(get_db)):
    """Create a new quarterly goal (legacy endpoint)."""
    if not validate_date_range(goal.start_date, goal.end_date):
        raise HTTPException(status_code=400, detail='end_date must be after start_date')

    db_goal = models.QuarterlyGoal(text=goal.text, start_date=goal.start_date, end_date=goal.end_date)
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return _legacy_goal_to_response(db_goal)


@router.put('/quarterly/{goal_id}', response_model=schemas.GoalResponse)
def update_quarterly_goal(goal_id: int, goal_update: schemas.GoalUpdate, db: Session = Depends(get_db)):
    """Update a quarterly goal (legacy endpoint)."""
    db_goal = db.query(models.QuarterlyGoal).filter(models.QuarterlyGoal.id == goal_id).first()

    if not db_goal:
        raise HTTPException(status_code=404, detail='Quarterly goal not found')

    if goal_update.text is not None:
        db_goal.text = goal_update.text

    if goal_update.start_date is not None or goal_update.end_date is not None:
        new_start = goal_update.start_date if goal_update.start_date is not None else db_goal.start_date
        new_end = goal_update.end_date if goal_update.end_date is not None else db_goal.end_date

        if not validate_date_range(new_start, new_end):
            raise HTTPException(status_code=400, detail='end_date must be after start_date')

        if goal_update.start_date is not None:
            db_goal.start_date = goal_update.start_date
        if goal_update.end_date is not None:
            db_goal.end_date = goal_update.end_date

    db_goal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_goal)
    return _legacy_goal_to_response(db_goal)


@router.delete('/quarterly/{goal_id}')
def delete_quarterly_goal(goal_id: int, db: Session = Depends(get_db)):
    """Delete a quarterly goal (legacy endpoint)."""
    db_goal = db.query(models.QuarterlyGoal).filter(models.QuarterlyGoal.id == goal_id).first()

    if not db_goal:
        raise HTTPException(status_code=404, detail='Quarterly goal not found')

    db.delete(db_goal)
    db.commit()
    return {'message': 'Quarterly goal deleted successfully'}
