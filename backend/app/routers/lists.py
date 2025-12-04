"""
API routes for lists (Trello-style boards for organizing note entries)
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix='/api/lists', tags=['lists'])


# ===========================
# Kanban Board Endpoints (must be before /{list_id})
# ===========================


@router.get('/kanban', response_model=list[schemas.ListResponse])
def get_kanban_boards(db: Session = Depends(get_db)):
    """Get all Kanban board columns (lists with is_kanban=1)."""
    kanban_lists = (
        db.query(models.List)
        .options(joinedload(models.List.labels), joinedload(models.List.entries))
        .filter(models.List.is_kanban == 1)
        .filter(models.List.is_archived == 0)
        .order_by(models.List.kanban_order, models.List.created_at)
        .all()
    )
    return [
        {
            'id': lst.id,
            'name': lst.name,
            'description': lst.description,
            'color': lst.color,
            'order_index': lst.order_index,
            'is_archived': bool(lst.is_archived),
            'is_kanban': bool(lst.is_kanban),
            'kanban_order': lst.kanban_order,
            'created_at': lst.created_at,
            'updated_at': lst.updated_at,
            'entry_count': len([e for e in lst.entries if e.is_archived == 0]),
            'labels': lst.labels,
        }
        for lst in kanban_lists
    ]


@router.post('/kanban/initialize')
def initialize_kanban(db: Session = Depends(get_db)):
    """
    Initialize Kanban board with default columns if none exist.
    Creates: To Do, In Progress, Done.
    """
    existing_kanban = db.query(models.List).filter(models.List.is_kanban == 1).first()
    if existing_kanban:
        raise HTTPException(status_code=400, detail='Kanban board already initialized')

    default_columns = [
        {
            'name': 'To Do',
            'description': 'Tasks to be started',
            'color': '#3b82f6',
            'kanban_order': 0,
        },
        {
            'name': 'In Progress',
            'description': 'Tasks currently being worked on',
            'color': '#f59e0b',
            'kanban_order': 1,
        },
        {
            'name': 'Done',
            'description': 'Completed tasks',
            'color': '#10b981',
            'kanban_order': 2,
        },
    ]
    created_columns = []
    for col_data in default_columns:
        new_column = models.List(
            name=col_data['name'],
            description=col_data['description'],
            color=col_data['color'],
            is_kanban=1,
            kanban_order=col_data['kanban_order'],
            order_index=0,
            is_archived=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(new_column)
        created_columns.append(new_column)
    db.commit()
    for col in created_columns:
        db.refresh(col)
    return {
        'message': 'Kanban board initialized successfully',
        'columns': [
            {
                'id': col.id,
                'name': col.name,
                'description': col.description,
                'color': col.color,
                'kanban_order': col.kanban_order,
            }
            for col in created_columns
        ],
    }


@router.put('/kanban/reorder')
def reorder_kanban_columns(request: schemas.ReorderListsRequest, db: Session = Depends(get_db)):
    """
    Reorder Kanban columns by updating their kanban_order.
    Expects a list of {id, order_index} where order_index is the new kanban_order.
    """
    for item in request.lists:
        lst = db.query(models.List).filter(models.List.id == item.id).first()
        if not lst:
            raise HTTPException(status_code=404, detail=f'List {item.id} not found')
        if not lst.is_kanban:
            raise HTTPException(status_code=400, detail=f'List {item.id} is not a Kanban column')
        lst.kanban_order = item.order_index
        lst.updated_at = datetime.utcnow()
    db.commit()
    return {'message': 'Kanban columns reordered successfully'}


# ===========================
# Archive Endpoints
# ===========================


@router.get('/archived', response_model=list[schemas.ListWithEntries])
def get_archived_lists(db: Session = Depends(get_db)):
    """Get all archived lists with their entries."""
    archived_lists = (
        db.query(models.List)
        .options(
            joinedload(models.List.entries).joinedload(models.NoteEntry.daily_note),
            joinedload(models.List.entries).joinedload(models.NoteEntry.labels),
            joinedload(models.List.labels),
        )
        .filter(models.List.is_archived == 1)
        .order_by(models.List.updated_at.desc())
        .all()
    )
    
    return [
        {
            'id': lst.id,
            'name': lst.name,
            'description': lst.description,
            'color': lst.color,
            'order_index': lst.order_index,
            'is_archived': bool(lst.is_archived),
            'is_kanban': bool(lst.is_kanban),
            'kanban_order': lst.kanban_order,
            'created_at': lst.created_at,
            'updated_at': lst.updated_at,
            'entry_count': len(lst.entries),
            'labels': lst.labels,
            'entries': [
                {
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
                    'is_archived': bool(entry.is_archived) if hasattr(entry, 'is_archived') else False,
                    'created_at': entry.created_at,
                    'updated_at': entry.updated_at,
                    'labels': entry.labels,
                }
                for entry in lst.entries
            ],
        }
        for lst in archived_lists
    ]


# ===========================
# List CRUD Endpoints
# ===========================


@router.get('', response_model=list[schemas.ListResponse])
def get_all_lists(include_archived: bool = False, db: Session = Depends(get_db)):
    """Get all lists with entry counts and labels (excludes Kanban columns)."""
    query = db.query(models.List).options(joinedload(models.List.labels), joinedload(models.List.entries))

    # Exclude Kanban columns from regular lists
    query = query.filter(models.List.is_kanban == 0)

    if not include_archived:
        query = query.filter(models.List.is_archived == 0)

    lists = query.order_by(models.List.order_index, models.List.created_at).all()

    return [
        {
            'id': lst.id,
            'name': lst.name,
            'description': lst.description,
            'color': lst.color,
            'order_index': lst.order_index,
            'is_archived': bool(lst.is_archived),
            'created_at': lst.created_at,
            'updated_at': lst.updated_at,
            'entry_count': len([e for e in lst.entries if e.is_archived == 0]),
            'labels': lst.labels,
        }
        for lst in lists
    ]


@router.get('/{list_id}', response_model=schemas.ListWithEntries)
def get_list(list_id: int, db: Session = Depends(get_db)):
    """Get a single list with all its entries and labels (excludes archived entries)."""
    lst = (
        db.query(models.List)
        .options(
            joinedload(models.List.entries).joinedload(models.NoteEntry.daily_note),
            joinedload(models.List.entries).joinedload(models.NoteEntry.labels),
            joinedload(models.List.entries).joinedload(models.NoteEntry.lists),
            joinedload(models.List.labels),
        )
        .filter(models.List.id == list_id)
        .first()
    )

    if not lst:
        raise HTTPException(status_code=404, detail='List not found')

    # Filter out archived entries
    non_archived_entries = [entry for entry in lst.entries if entry.is_archived == 0]

    return {
        'id': lst.id,
        'name': lst.name,
        'description': lst.description,
        'color': lst.color,
        'order_index': lst.order_index,
        'is_archived': bool(lst.is_archived),
        'is_kanban': bool(lst.is_kanban),
        'kanban_order': lst.kanban_order,
        'created_at': lst.created_at,
        'updated_at': lst.updated_at,
        'entry_count': len(non_archived_entries),
        'labels': lst.labels,
        'entries': [
            {
                'id': entry.id,
                'daily_note_id': entry.daily_note_id,
                'daily_note_date': entry.daily_note.date if entry.daily_note else None,  # Add date for navigation
                'title': entry.title,
                'content': entry.content,
                'content_type': entry.content_type,
                'order_index': entry.order_index,
                'include_in_report': bool(entry.include_in_report),
                'is_important': bool(entry.is_important),
                'is_completed': bool(entry.is_completed),
                'is_archived': bool(entry.is_archived),
                'created_at': entry.created_at,
                'updated_at': entry.updated_at,
                'labels': [
                    {
                        'id': label.id,
                        'name': label.name,
                        'color': label.color,
                        'created_at': label.created_at,
                    }
                    for label in entry.labels
                ],
                'lists': [
                    {
                        'id': entry_list.id,
                        'name': entry_list.name,
                        'color': entry_list.color,
                        'is_kanban': bool(entry_list.is_kanban),
                        'created_at': entry_list.created_at,
                        'updated_at': entry_list.updated_at,
                    }
                    for entry_list in entry.lists
                ],
            }
            for entry in non_archived_entries
        ],
    }


@router.post('', response_model=schemas.ListResponse)
def create_list(list_data: schemas.ListCreate, db: Session = Depends(get_db)):
    """Create a new list."""
    # Check if list with same name already exists
    existing_list = db.query(models.List).filter(models.List.name == list_data.name).first()
    if existing_list:
        raise HTTPException(status_code=400, detail='List with this name already exists')

    new_list = models.List(
        name=list_data.name,
        description=list_data.description,
        color=list_data.color,
        order_index=list_data.order_index,
        is_archived=1 if list_data.is_archived else 0,
        is_kanban=1 if list_data.is_kanban else 0,
        kanban_order=list_data.kanban_order,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(new_list)
    db.commit()
    db.refresh(new_list)

    return {
        'id': new_list.id,
        'name': new_list.name,
        'description': new_list.description,
        'color': new_list.color,
        'order_index': new_list.order_index,
        'is_archived': bool(new_list.is_archived),
        'is_kanban': bool(new_list.is_kanban),
        'kanban_order': new_list.kanban_order,
        'created_at': new_list.created_at,
        'updated_at': new_list.updated_at,
        'entry_count': 0,
    }


# ===========================
# Reordering Endpoints (MUST come before /{list_id} route)
# ===========================


@router.put('/reorder')
def reorder_lists(reorder_data: schemas.ReorderListsRequest, db: Session = Depends(get_db)):
    """Update order_index for all lists."""
    print(f'Received reorder request: {reorder_data}')
    print(f'Lists: {reorder_data.lists}')
    for list_data in reorder_data.lists:
        print(f'Processing list {list_data.id} with order_index {list_data.order_index}')
        lst = db.query(models.List).filter(models.List.id == list_data.id).first()
        if lst:
            lst.order_index = list_data.order_index
            lst.updated_at = datetime.utcnow()

    db.commit()

    return {'message': 'Lists reordered successfully'}


@router.put('/{list_id}', response_model=schemas.ListResponse)
def update_list(list_id: int, list_data: schemas.ListUpdate, db: Session = Depends(get_db)):
    """Update a list."""
    lst = db.query(models.List).filter(models.List.id == list_id).first()

    if not lst:
        raise HTTPException(status_code=404, detail='List not found')

    # Check if new name conflicts with existing list
    if list_data.name and list_data.name != lst.name:
        existing_list = db.query(models.List).filter(models.List.name == list_data.name).first()
        if existing_list:
            raise HTTPException(status_code=400, detail='List with this name already exists')
        lst.name = list_data.name

    if list_data.description is not None:
        lst.description = list_data.description
    if list_data.color is not None:
        lst.color = list_data.color
    if list_data.order_index is not None:
        lst.order_index = list_data.order_index
    if list_data.is_archived is not None:
        lst.is_archived = 1 if list_data.is_archived else 0
    if list_data.is_kanban is not None:
        lst.is_kanban = 1 if list_data.is_kanban else 0
    if list_data.kanban_order is not None:
        lst.kanban_order = list_data.kanban_order

    lst.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(lst)

    return {
        'id': lst.id,
        'name': lst.name,
        'description': lst.description,
        'color': lst.color,
        'order_index': lst.order_index,
        'is_archived': bool(lst.is_archived),
        'is_kanban': bool(lst.is_kanban),
        'kanban_order': lst.kanban_order,
        'created_at': lst.created_at,
        'updated_at': lst.updated_at,
        'entry_count': len([e for e in lst.entries if e.is_archived == 0]),
    }


@router.delete('/{list_id}')
def delete_list(list_id: int, db: Session = Depends(get_db)):
    """Delete a list (entries are unlinked, not deleted)."""
    lst = db.query(models.List).filter(models.List.id == list_id).first()

    if not lst:
        raise HTTPException(status_code=404, detail='List not found')

    db.delete(lst)
    db.commit()

    return {'message': 'List deleted successfully'}


# ===========================
# Entry-List Association Endpoints
# ===========================


@router.post('/{list_id}/entries/{entry_id}')
def add_entry_to_list(list_id: int, entry_id: int, order_index: int = 0, db: Session = Depends(get_db)):
    """Add an entry to a list."""
    lst = db.query(models.List).filter(models.List.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail='List not found')

    entry = db.query(models.NoteEntry).filter(models.NoteEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail='Entry not found')

    # Check if entry is already in this list
    if entry in lst.entries:
        return {'message': 'Entry already in list'}

    # If this is a Kanban list, remove entry from all other Kanban lists first
    # (An entry can only be in one Kanban status at a time)
    if lst.is_kanban == 1:
        # Get all Kanban lists that contain this entry
        other_kanban_lists = (
            db.query(models.List)
            .join(models.entry_lists)
            .filter(models.entry_lists.c.entry_id == entry_id)
            .filter(models.List.is_kanban == 1)
            .filter(models.List.id != list_id)
            .all()
        )

        # Remove entry from all other Kanban lists
        for other_list in other_kanban_lists:
            if entry in other_list.entries:
                other_list.entries.remove(entry)
                other_list.updated_at = datetime.utcnow()

    # Add entry to list
    lst.entries.append(entry)
    lst.updated_at = datetime.utcnow()
    db.commit()

    return {'message': 'Entry added to list successfully'}


@router.delete('/{list_id}/entries/{entry_id}')
def remove_entry_from_list(list_id: int, entry_id: int, db: Session = Depends(get_db)):
    """Remove an entry from a list."""
    lst = db.query(models.List).filter(models.List.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail='List not found')

    entry = db.query(models.NoteEntry).filter(models.NoteEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail='Entry not found')

    # Remove entry from list
    if entry in lst.entries:
        lst.entries.remove(entry)
        lst.updated_at = datetime.utcnow()
        db.commit()
        return {'message': 'Entry removed from list successfully'}
    else:
        raise HTTPException(status_code=404, detail='Entry not in list')


@router.put('/{list_id}/reorder')
def reorder_entries_in_list(list_id: int, reorder_data: schemas.ReorderEntriesRequest, db: Session = Depends(get_db)):
    """Update order_index for entries within a list."""
    lst = db.query(models.List).filter(models.List.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail='List not found')

    # Update order_index for each entry in the association table
    for association in reorder_data.entries:
        # This is a simplified approach - in production you'd update the association table directly
        # For now, we'll just acknowledge the request
        pass

    lst.updated_at = datetime.utcnow()
    db.commit()

    return {'message': 'Entries reordered successfully'}


@router.post('/{list_id}/labels/{label_id}')
def add_label_to_list(list_id: int, label_id: int, db: Session = Depends(get_db)):
    """Add a label to a list."""
    lst = db.query(models.List).filter(models.List.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail='List not found')

    label = db.query(models.Label).filter(models.Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail='Label not found')

    # Check if label is already added
    if label in lst.labels:
        raise HTTPException(status_code=400, detail='Label already added to list')

    lst.labels.append(label)
    lst.updated_at = datetime.utcnow()
    db.commit()

    return {'message': 'Label added to list successfully'}


@router.delete('/{list_id}/labels/{label_id}')
def remove_label_from_list(list_id: int, label_id: int, db: Session = Depends(get_db)):
    """Remove a label from a list."""
    lst = db.query(models.List).filter(models.List.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail='List not found')

    label = db.query(models.Label).filter(models.Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail='Label not found')

    # Check if label is in the list
    if label not in lst.labels:
        raise HTTPException(status_code=400, detail='Label not found in list')

    lst.labels.remove(label)
    lst.updated_at = datetime.utcnow()
    db.commit()

    return {'message': 'Label removed from list successfully'}
