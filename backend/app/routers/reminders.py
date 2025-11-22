"""
API routes for reminder management
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix='/api/reminders', tags=['reminders'])


@router.get('', response_model=list[schemas.ReminderWithEntry])
def get_reminders(include_dismissed: bool = False, db: Session = Depends(get_db)):
    """Get all reminders (excludes dismissed by default), sorted by reminder_datetime"""
    query = db.query(models.Reminder).options(joinedload(models.Reminder.entry).joinedload(models.NoteEntry.daily_note))

    if not include_dismissed:
        query = query.filter(models.Reminder.is_dismissed == 0)

    reminders = query.order_by(models.Reminder.reminder_datetime).all()

    return [
        {
            'id': reminder.id,
            'entry_id': reminder.entry_id,
            'reminder_datetime': reminder.reminder_datetime,
            'is_dismissed': bool(reminder.is_dismissed),
            'created_at': reminder.created_at,
            'updated_at': reminder.updated_at,
            'entry': {
                'id': reminder.entry.id,
                'daily_note_id': reminder.entry.daily_note_id,
                'daily_note_date': reminder.entry.daily_note.date if reminder.entry.daily_note else None,
                'title': reminder.entry.title,
                'content': reminder.entry.content,
                'content_type': reminder.entry.content_type,
            }
            if reminder.entry
            else None,
        }
        for reminder in reminders
    ]


@router.get('/due', response_model=list[schemas.ReminderWithEntry])
def get_due_reminders(db: Session = Depends(get_db)):
    """Get reminders that are due now (reminder_datetime <= current time, not dismissed)"""
    current_time = datetime.utcnow().isoformat()

    reminders = (
        db.query(models.Reminder)
        .options(joinedload(models.Reminder.entry).joinedload(models.NoteEntry.daily_note))
        .filter(models.Reminder.is_dismissed == 0)
        .filter(models.Reminder.reminder_datetime <= current_time)
        .order_by(models.Reminder.reminder_datetime)
        .all()
    )

    return [
        {
            'id': reminder.id,
            'entry_id': reminder.entry_id,
            'reminder_datetime': reminder.reminder_datetime,
            'is_dismissed': bool(reminder.is_dismissed),
            'created_at': reminder.created_at,
            'updated_at': reminder.updated_at,
            'entry': {
                'id': reminder.entry.id,
                'daily_note_id': reminder.entry.daily_note_id,
                'daily_note_date': reminder.entry.daily_note.date if reminder.entry.daily_note else None,
                'title': reminder.entry.title,
                'content': reminder.entry.content,
                'content_type': reminder.entry.content_type,
            }
            if reminder.entry
            else None,
        }
        for reminder in reminders
    ]


@router.get('/entry/{entry_id}', response_model=schemas.ReminderResponse | None)
def get_reminder_for_entry(entry_id: int, db: Session = Depends(get_db)):
    """Get active (non-dismissed) reminder for a specific entry"""
    reminder = (
        db.query(models.Reminder)
        .options(joinedload(models.Reminder.entry).joinedload(models.NoteEntry.daily_note))
        .filter(models.Reminder.entry_id == entry_id)
        .filter(models.Reminder.is_dismissed == 0)
        .first()
    )

    if not reminder:
        return None

    return {
        'id': reminder.id,
        'entry_id': reminder.entry_id,
        'reminder_datetime': reminder.reminder_datetime,
        'is_dismissed': bool(reminder.is_dismissed),
        'created_at': reminder.created_at,
        'updated_at': reminder.updated_at,
        'entry': {
            'id': reminder.entry.id,
            'daily_note_id': reminder.entry.daily_note_id,
            'daily_note_date': reminder.entry.daily_note.date if reminder.entry.daily_note else None,
            'title': reminder.entry.title,
            'content': reminder.entry.content,
            'content_type': reminder.entry.content_type,
            'order_index': reminder.entry.order_index,
            'created_at': reminder.entry.created_at,
            'updated_at': reminder.entry.updated_at,
            'labels': reminder.entry.labels,
            'lists': reminder.entry.lists,
            'include_in_report': bool(reminder.entry.include_in_report),
            'is_important': bool(reminder.entry.is_important),
            'is_completed': bool(reminder.entry.is_completed),
            'is_pinned': bool(reminder.entry.is_pinned),
        }
        if reminder.entry
        else None,
    }


@router.post('', response_model=schemas.ReminderResponse)
def create_reminder(reminder_data: schemas.ReminderCreate, db: Session = Depends(get_db)):
    """Create a new reminder for an entry (one per entry)"""
    # Check if entry exists
    entry = db.query(models.NoteEntry).filter(models.NoteEntry.id == reminder_data.entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail='Entry not found')

    # Check if an active (non-dismissed) reminder already exists for this entry
    existing_reminder = (
        db.query(models.Reminder)
        .filter(models.Reminder.entry_id == reminder_data.entry_id)
        .filter(models.Reminder.is_dismissed == 0)
        .first()
    )
    if existing_reminder:
        raise HTTPException(
            status_code=400, detail='Active reminder already exists for this entry. Use PATCH to update.'
        )

    # Check if a dismissed reminder exists - if so, update it instead of creating new
    dismissed_reminder = (
        db.query(models.Reminder)
        .filter(models.Reminder.entry_id == reminder_data.entry_id)
        .filter(models.Reminder.is_dismissed == 1)
        .first()
    )

    if dismissed_reminder:
        # Reactivate the dismissed reminder with new datetime
        dismissed_reminder.reminder_datetime = reminder_data.reminder_datetime
        dismissed_reminder.is_dismissed = 0
        dismissed_reminder.updated_at = datetime.utcnow()
        db.commit()

        # Load relationships
        new_reminder = (
            db.query(models.Reminder)
            .options(joinedload(models.Reminder.entry).joinedload(models.NoteEntry.daily_note))
            .filter(models.Reminder.id == dismissed_reminder.id)
            .first()
        )
    else:
        # Create new reminder
        new_reminder = models.Reminder(
            entry_id=reminder_data.entry_id,
            reminder_datetime=reminder_data.reminder_datetime,
            is_dismissed=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(new_reminder)
        db.commit()
        db.refresh(new_reminder)

        # Load entry and daily_note relationships
        new_reminder = (
            db.query(models.Reminder)
            .options(joinedload(models.Reminder.entry).joinedload(models.NoteEntry.daily_note))
            .filter(models.Reminder.id == new_reminder.id)
            .first()
        )

    return {
        'id': new_reminder.id,
        'entry_id': new_reminder.entry_id,
        'reminder_datetime': new_reminder.reminder_datetime,
        'is_dismissed': bool(new_reminder.is_dismissed),
        'created_at': new_reminder.created_at,
        'updated_at': new_reminder.updated_at,
        'entry': {
            'id': new_reminder.entry.id,
            'daily_note_id': new_reminder.entry.daily_note_id,
            'daily_note_date': new_reminder.entry.daily_note.date if new_reminder.entry.daily_note else None,
            'title': new_reminder.entry.title,
            'content': new_reminder.entry.content,
            'content_type': new_reminder.entry.content_type,
            'order_index': new_reminder.entry.order_index,
            'created_at': new_reminder.entry.created_at,
            'updated_at': new_reminder.entry.updated_at,
            'labels': new_reminder.entry.labels,
            'lists': new_reminder.entry.lists,
            'include_in_report': bool(new_reminder.entry.include_in_report),
            'is_important': bool(new_reminder.entry.is_important),
            'is_completed': bool(new_reminder.entry.is_completed),
            'is_pinned': bool(new_reminder.entry.is_pinned),
        }
        if new_reminder.entry
        else None,
    }


@router.patch('/{reminder_id}', response_model=schemas.ReminderResponse)
def update_reminder(reminder_id: int, reminder_update: schemas.ReminderUpdate, db: Session = Depends(get_db)):
    """Update a reminder (for snoozing or manual edits)"""
    reminder = (
        db.query(models.Reminder)
        .options(joinedload(models.Reminder.entry).joinedload(models.NoteEntry.daily_note))
        .filter(models.Reminder.id == reminder_id)
        .first()
    )

    if not reminder:
        raise HTTPException(status_code=404, detail='Reminder not found')

    # Update fields if provided
    if reminder_update.reminder_datetime is not None:
        reminder.reminder_datetime = reminder_update.reminder_datetime

    if reminder_update.is_dismissed is not None:
        reminder.is_dismissed = 1 if reminder_update.is_dismissed else 0

    reminder.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(reminder)

    return {
        'id': reminder.id,
        'entry_id': reminder.entry_id,
        'reminder_datetime': reminder.reminder_datetime,
        'is_dismissed': bool(reminder.is_dismissed),
        'created_at': reminder.created_at,
        'updated_at': reminder.updated_at,
        'entry': {
            'id': reminder.entry.id,
            'daily_note_id': reminder.entry.daily_note_id,
            'daily_note_date': reminder.entry.daily_note.date if reminder.entry.daily_note else None,
            'title': reminder.entry.title,
            'content': reminder.entry.content,
            'content_type': reminder.entry.content_type,
            'order_index': reminder.entry.order_index,
            'created_at': reminder.entry.created_at,
            'updated_at': reminder.entry.updated_at,
            'labels': reminder.entry.labels,
            'lists': reminder.entry.lists,
            'include_in_report': bool(reminder.entry.include_in_report),
            'is_important': bool(reminder.entry.is_important),
            'is_completed': bool(reminder.entry.is_completed),
            'is_pinned': bool(reminder.entry.is_pinned),
        }
        if reminder.entry
        else None,
    }


@router.delete('/{reminder_id}')
def delete_reminder(reminder_id: int, db: Session = Depends(get_db)):
    """Delete a reminder"""
    reminder = db.query(models.Reminder).filter(models.Reminder.id == reminder_id).first()

    if not reminder:
        raise HTTPException(status_code=404, detail='Reminder not found')

    db.delete(reminder)
    db.commit()

    return {'message': 'Reminder deleted', 'id': reminder_id}
