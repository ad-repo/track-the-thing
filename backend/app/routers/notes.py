from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routers.entries import copy_pinned_entries_to_date

router = APIRouter()


@router.get('/')
def get_all_notes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all daily notes"""
    # Expire all objects to force fresh queries
    db.expire_all()

    notes = db.query(models.DailyNote).order_by(models.DailyNote.date.desc()).offset(skip).limit(limit).all()

    # Manually construct response to include daily_note_date
    result = []
    for note in notes:
        # Query entries directly, excluding archived ones
        entries = (
            db.query(models.NoteEntry)
            .filter(models.NoteEntry.daily_note_id == note.id)
            .filter(models.NoteEntry.is_archived == 0)
            .order_by(models.NoteEntry.order_index.desc(), models.NoteEntry.created_at.desc())
            .all()
        )

        note_dict = {
            'id': note.id,
            'date': note.date,
            'fire_rating': note.fire_rating,
            'daily_goal': note.daily_goal,
            'created_at': note.created_at,
            'updated_at': note.updated_at,
            'entries': [
                {
                    'id': entry.id,
                    'daily_note_id': entry.daily_note_id,
                    'daily_note_date': note.date,  # Add the parent note's date
                    'title': entry.title,
                    'content': entry.content,
                    'content_type': entry.content_type,
                    'order_index': entry.order_index,
                    'include_in_report': bool(entry.include_in_report),
                    'is_important': bool(entry.is_important),
                    'is_completed': bool(entry.is_completed),
                    'is_pinned': bool(entry.is_pinned),
                    'is_archived': bool(entry.is_archived),
                    'created_at': entry.created_at,
                    'updated_at': entry.updated_at,
                    'labels': entry.labels,
                    'lists': entry.lists,
                    'reminder': entry.reminder,
                }
                for entry in entries
            ],
            'labels': note.labels,
        }
        result.append(note_dict)

    return result


@router.get('/{date}', response_model=schemas.DailyNote)
def get_note_by_date(date: str, db: Session = Depends(get_db)):
    """Get a specific daily note by date (YYYY-MM-DD)"""
    # First, copy any pinned entries from previous days
    copy_pinned_entries_to_date(date, db)

    note = db.query(models.DailyNote).filter(models.DailyNote.date == date).first()
    if not note:
        raise HTTPException(status_code=404, detail='Note not found for this date')

    # Query entries directly, excluding archived ones
    entries = (
        db.query(models.NoteEntry)
        .filter(models.NoteEntry.daily_note_id == note.id)
        .filter(models.NoteEntry.is_archived == 0)
        .order_by(models.NoteEntry.order_index.desc(), models.NoteEntry.created_at.desc())
        .all()
    )

    # Manually construct response with non-archived entries
    result = {
        'id': note.id,
        'date': note.date,
        'fire_rating': note.fire_rating,
        'daily_goal': note.daily_goal,
        'created_at': note.created_at,
        'updated_at': note.updated_at,
        'entries': [
            {
                'id': entry.id,
                'daily_note_id': entry.daily_note_id,
                'daily_note_date': note.date,
                'title': entry.title,
                'content': entry.content,
                'content_type': entry.content_type,
                'order_index': entry.order_index,
                'include_in_report': bool(entry.include_in_report),
                'is_important': bool(entry.is_important),
                'is_completed': bool(entry.is_completed),
                'is_pinned': bool(entry.is_pinned),
                'is_archived': bool(entry.is_archived),
                'created_at': entry.created_at,
                'updated_at': entry.updated_at,
                'labels': entry.labels,
                'lists': entry.lists,
                'reminder': entry.reminder,
            }
            for entry in entries
        ],
        'labels': note.labels,
    }

    return result


@router.post('/', response_model=schemas.DailyNote, status_code=201)
def create_note(note: schemas.DailyNoteCreate, db: Session = Depends(get_db)):
    """Create a new daily note"""
    # Check if note already exists for this date
    existing_note = db.query(models.DailyNote).filter(models.DailyNote.date == note.date).first()
    if existing_note:
        raise HTTPException(status_code=400, detail='Note already exists for this date')

    db_note = models.DailyNote(**note.model_dump())
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note


@router.put('/{date}', response_model=schemas.DailyNote)
def update_note(date: str, note_update: schemas.DailyNoteUpdate, db: Session = Depends(get_db)):
    """Update a daily note (mainly for fire rating)"""
    db_note = db.query(models.DailyNote).filter(models.DailyNote.date == date).first()
    if not db_note:
        raise HTTPException(status_code=404, detail='Note not found for this date')

    update_data = note_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_note, key, value)

    db_note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_note)
    return db_note


@router.delete('/{date}', status_code=204)
def delete_note(date: str, db: Session = Depends(get_db)):
    """Delete a daily note and all its entries"""
    db_note = db.query(models.DailyNote).filter(models.DailyNote.date == date).first()
    if not db_note:
        raise HTTPException(status_code=404, detail='Note not found for this date')

    db.delete(db_note)
    db.commit()
    return None


@router.get('/month/{year}/{month}', response_model=list[schemas.DailyNote])
def get_notes_by_month(year: int, month: int, db: Session = Depends(get_db)):
    """Get all notes for a specific month"""
    start_date = f'{year}-{month:02d}-01'
    if month == 12:
        end_date = f'{year + 1}-01-01'
    else:
        end_date = f'{year}-{month + 1:02d}-01'

    notes = (
        db.query(models.DailyNote)
        .filter(models.DailyNote.date >= start_date, models.DailyNote.date < end_date)
        .order_by(models.DailyNote.date)
        .all()
    )

    return notes
