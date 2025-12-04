from datetime import datetime

import sqlalchemy
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db

router = APIRouter()


def copy_pinned_entries_to_date(date: str, db: Session):
    """
    Copy pinned entries from previous days to the specified date if they don't already exist.
    This is called when getting entries for a date to ensure pinned entries carry forward.
    """
    # Get or create the daily note for this date
    note = db.query(models.DailyNote).filter(models.DailyNote.date == date).first()
    if not note:
        note = models.DailyNote(date=date)
        db.add(note)
        db.commit()
        db.refresh(note)

    # Get all pinned entries from before this date
    all_pinned = (
        db.query(models.NoteEntry)
        .join(models.DailyNote)
        .filter(models.NoteEntry.is_pinned == 1)
        .filter(models.DailyNote.date < date)
        .all()
    )

    if not all_pinned:
        return

    # Get existing entry IDs for this date to avoid duplicates
    existing_entries = db.query(models.NoteEntry).filter(models.NoteEntry.daily_note_id == note.id).all()

    # Create a set of content hashes to check for duplicates
    # Check against ALL entries, not just pinned ones, to avoid creating duplicates of unpinned entries
    existing_pinned_content = {(entry.content, entry.title) for entry in existing_entries}

    # Copy each pinned entry if it doesn't already exist for this date
    for pinned_entry in all_pinned:
        content_key = (pinned_entry.content, pinned_entry.title)

        if content_key not in existing_pinned_content:
            # Create a copy of the pinned entry for this date
            new_entry = models.NoteEntry(
                daily_note_id=note.id,
                title=pinned_entry.title,
                content=pinned_entry.content,
                content_type=pinned_entry.content_type,
                order_index=pinned_entry.order_index,
                include_in_report=pinned_entry.include_in_report,
                is_important=pinned_entry.is_important,
                is_completed=0,  # Reset completion status for new day
                is_pinned=1,  # Keep it pinned
            )
            db.add(new_entry)
            db.flush()  # Flush to assign ID
            # Add to set to prevent duplicates within this loop
            existing_pinned_content.add(content_key)

            # Copy labels using direct SQL insert to avoid lazy loading
            label_rows = db.execute(
                sqlalchemy.text('SELECT label_id FROM entry_labels WHERE entry_id = :old_id'),
                {'old_id': pinned_entry.id},
            ).fetchall()

            for row in label_rows:
                db.execute(
                    sqlalchemy.text('INSERT INTO entry_labels (entry_id, label_id) VALUES (:new_id, :label_id)'),
                    {'new_id': new_entry.id, 'label_id': row[0]},
                )

            # Copy list associations using direct SQL insert
            list_rows = db.execute(
                sqlalchemy.text('SELECT list_id FROM entry_lists WHERE entry_id = :old_id'), {'old_id': pinned_entry.id}
            ).fetchall()

            for row in list_rows:
                db.execute(
                    sqlalchemy.text('INSERT INTO entry_lists (entry_id, list_id) VALUES (:new_id, :list_id)'),
                    {'new_id': new_entry.id, 'list_id': row[0]},
                )

    db.commit()


@router.get('/note/{date}', response_model=list[schemas.NoteEntry])
def get_entries_for_date(date: str, db: Session = Depends(get_db)):
    """Get all entries for a specific date"""
    # First, copy any pinned entries from previous days
    copy_pinned_entries_to_date(date, db)

    note = db.query(models.DailyNote).filter(models.DailyNote.date == date).first()
    if not note:
        raise HTTPException(status_code=404, detail='Note not found for this date')

    # Order by order_index descending (higher values first), then by created_at descending (newest first)
    # Exclude archived entries from the daily view
    entries = (
        db.query(models.NoteEntry)
        .filter(models.NoteEntry.daily_note_id == note.id)
        .filter(models.NoteEntry.is_archived == 0)
        .order_by(models.NoteEntry.order_index.desc(), models.NoteEntry.created_at.desc())
        .all()
    )

    return entries


@router.post('/note/{date}', response_model=schemas.NoteEntry, status_code=201)
def create_entry(date: str, entry: schemas.NoteEntryCreate, db: Session = Depends(get_db)):
    """Create a new entry for a specific date"""
    # Get or create daily note for this date
    note = db.query(models.DailyNote).filter(models.DailyNote.date == date).first()
    if not note:
        note = models.DailyNote(date=date)
        db.add(note)
        db.commit()
        db.refresh(note)

    db_entry = models.NoteEntry(**entry.model_dump(), daily_note_id=note.id)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


@router.put('/{entry_id}', response_model=schemas.NoteEntry)
@router.patch('/{entry_id}', response_model=schemas.NoteEntry)
def update_entry(entry_id: int, entry_update: schemas.NoteEntryUpdate, db: Session = Depends(get_db)):
    """Update a specific entry"""
    db_entry = db.query(models.NoteEntry).filter(models.NoteEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail='Entry not found')

    update_data = entry_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        # Handle boolean to integer conversion for SQLite
        if key in ['include_in_report', 'is_important', 'is_completed', 'is_pinned', 'is_archived']:
            setattr(db_entry, key, 1 if value else 0)
        else:
            setattr(db_entry, key, value)

    db_entry.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_entry)
    return db_entry


@router.delete('/{entry_id}', status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    """
    Delete a specific entry.
    If the entry is pinned OR is a copy of a pinned entry, unpin all copies first,
    then delete only this specific entry.
    """
    db_entry = db.query(models.NoteEntry).filter(models.NoteEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail='Entry not found')

    # Find all entries with the same content and title (potential copies of a pinned entry)
    all_matching = (
        db.query(models.NoteEntry)
        .filter(models.NoteEntry.content == db_entry.content)
        .filter(models.NoteEntry.title == db_entry.title)
        .all()
    )

    # Check if ANY of the matching entries are pinned
    has_pinned = any(entry.is_pinned == 1 for entry in all_matching)

    if has_pinned:
        # Unpin all matching entries to prevent them from being copied forward
        for entry in all_matching:
            if entry.is_pinned == 1:
                entry.is_pinned = 0

        db.commit()

        # Refresh to ensure changes are persisted
        db.refresh(db_entry)

    # Now delete this specific entry
    db.delete(db_entry)
    db.commit()
    return None


@router.post('/{entry_id}/move-to-top', response_model=schemas.NoteEntry)
def move_entry_to_top(entry_id: int, db: Session = Depends(get_db)):
    """Move an entry to the top of the list for its day"""
    db_entry = db.query(models.NoteEntry).filter(models.NoteEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail='Entry not found')

    # Find the highest order_index for entries in the same day
    max_order = (
        db.query(models.NoteEntry.order_index)
        .filter(models.NoteEntry.daily_note_id == db_entry.daily_note_id)
        .order_by(models.NoteEntry.order_index.desc())
        .first()
    )

    # Set this entry's order_index to be higher than the current max
    new_order_index = (max_order[0] if max_order and max_order[0] is not None else 0) + 1
    db_entry.order_index = new_order_index
    db_entry.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(db_entry)
    return db_entry


@router.post('/{entry_id}/toggle-pin', response_model=schemas.NoteEntry)
def toggle_pin(entry_id: int, db: Session = Depends(get_db)):
    """Toggle the pinned status of an entry"""
    db_entry = db.query(models.NoteEntry).filter(models.NoteEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail='Entry not found')

    # Toggle the pinned status
    db_entry.is_pinned = 0 if db_entry.is_pinned else 1
    db_entry.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(db_entry)
    return db_entry


@router.post('/{entry_id}/toggle-archive', response_model=schemas.NoteEntry)
def toggle_archive(entry_id: int, db: Session = Depends(get_db)):
    """Toggle the archived status of an entry"""
    db_entry = db.query(models.NoteEntry).filter(models.NoteEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail='Entry not found')

    # Toggle the archived status
    db_entry.is_archived = 0 if db_entry.is_archived else 1
    db_entry.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(db_entry)
    return db_entry


@router.get('/archived', response_model=list[schemas.NoteEntry])
def get_archived_entries(db: Session = Depends(get_db)):
    """Get all archived entries"""
    entries = (
        db.query(models.NoteEntry)
        .join(models.DailyNote)
        .options(
            joinedload(models.NoteEntry.daily_note),
            joinedload(models.NoteEntry.labels),
            joinedload(models.NoteEntry.lists),
            joinedload(models.NoteEntry.reminder),
        )
        .filter(models.NoteEntry.is_archived == 1)
        .order_by(models.NoteEntry.updated_at.desc())
        .all()
    )
    
    # Add daily_note_date to each entry for navigation
    result = []
    for entry in entries:
        entry_dict = {
            'id': entry.id,
            'daily_note_id': entry.daily_note_id,
            'daily_note_date': entry.daily_note.date if entry.daily_note else None,
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
        result.append(entry_dict)
    
    return result


@router.get('/{entry_id}', response_model=schemas.NoteEntry)
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    """Get a specific entry by ID"""
    entry = db.query(models.NoteEntry).filter(models.NoteEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail='Entry not found')
    return entry


@router.post('/merge', response_model=schemas.NoteEntry, status_code=201)
def merge_entries(merge_request: schemas.MergeEntriesRequest, db: Session = Depends(get_db)):
    """Merge multiple entries into a single entry"""
    if len(merge_request.entry_ids) < 2:
        raise HTTPException(status_code=400, detail='At least 2 entries are required to merge')

    # Fetch all entries to merge
    entries = (
        db.query(models.NoteEntry)
        .filter(models.NoteEntry.id.in_(merge_request.entry_ids))
        .order_by(models.NoteEntry.created_at.asc())
        .all()
    )

    if len(entries) != len(merge_request.entry_ids):
        raise HTTPException(status_code=404, detail='One or more entries not found')

    # Verify all entries belong to the same day
    daily_note_ids = set(entry.daily_note_id for entry in entries)
    if len(daily_note_ids) > 1:
        raise HTTPException(status_code=400, detail='Cannot merge entries from different days')

    # Collect all unique labels from all entries
    all_labels = set()
    for entry in entries:
        all_labels.update(entry.labels)

    # Determine content type (use first entry's type, or 'rich_text' if mixed)
    content_types = set(entry.content_type for entry in entries)
    if len(content_types) == 1:
        merged_content_type = entries[0].content_type
    else:
        merged_content_type = 'rich_text'  # Default to rich text if mixed types

    # Merge content (oldest to newest)
    merged_content = merge_request.separator.join(entry.content for entry in entries)

    # Determine merged metadata (OR logic for booleans)
    is_important = any(entry.is_important for entry in entries)
    is_completed = all(entry.is_completed for entry in entries)  # All must be completed
    include_in_report = any(entry.include_in_report for entry in entries)

    # Create the merged entry
    merged_entry = models.NoteEntry(
        daily_note_id=entries[0].daily_note_id,
        content=merged_content,
        content_type=merged_content_type,
        order_index=entries[0].order_index,
        include_in_report=1 if include_in_report else 0,
        is_important=1 if is_important else 0,
        is_completed=1 if is_completed else 0,
        created_at=entries[0].created_at,  # Use earliest created_at
    )

    db.add(merged_entry)
    db.flush()

    # Add all unique labels to merged entry
    for label in all_labels:
        if label not in merged_entry.labels:
            merged_entry.labels.append(label)

    # Delete original entries if requested
    if merge_request.delete_originals:
        for entry in entries:
            db.delete(entry)

    db.commit()
    db.refresh(merged_entry)

    return merged_entry
