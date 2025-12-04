from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db

router = APIRouter()


@router.get('/', response_model=list[schemas.SearchResult])
def search_entries(
    q: str | None = Query(None, description='Search query for content'),
    label_ids: str | None = Query(None, description='Comma-separated label IDs to filter by'),
    list_ids: str | None = Query(None, description='Comma-separated list IDs to filter by'),
    is_important: bool | None = Query(None, description='Filter by starred/important entries'),
    is_completed: bool | None = Query(None, description='Filter by completed entries'),
    include_archived: bool = Query(False, description='Include archived entries in search results'),
    db: Session = Depends(get_db),
):
    """
    Global search across all entries.
    Can search by text content and/or filter by labels, lists, starred status, or completion status.
    """
    # Start with base query that loads relationships
    query = db.query(models.NoteEntry).options(
        joinedload(models.NoteEntry.labels), joinedload(models.NoteEntry.lists), joinedload(models.NoteEntry.daily_note)
    )

    # Filter out archived entries by default
    if not include_archived:
        query = query.filter(models.NoteEntry.is_archived == 0)

    # Filter by text in title or content if provided
    if q and q.strip():
        search_term = f'%{q.strip()}%'
        query = query.filter(
            or_(
                models.NoteEntry.title.ilike(search_term),
                models.NoteEntry.content.ilike(search_term),
            )
        )

    # Filter by labels if provided
    if label_ids and label_ids.strip():
        try:
            label_id_list = [int(lid.strip()) for lid in label_ids.split(',') if lid.strip()]
            if label_id_list:
                # Join with entry_labels table to filter by labels
                query = query.join(models.NoteEntry.labels).filter(models.Label.id.in_(label_id_list)).distinct()
        except ValueError:
            pass  # Invalid label IDs, ignore

    # Filter by lists if provided
    if list_ids and list_ids.strip():
        try:
            list_id_list = [int(lid.strip()) for lid in list_ids.split(',') if lid.strip()]
            if list_id_list:
                # Join with entry_lists table to filter by lists
                query = query.join(models.NoteEntry.lists).filter(models.List.id.in_(list_id_list)).distinct()
        except ValueError:
            pass  # Invalid list IDs, ignore

    # Filter by starred/important status if provided
    if is_important is not None:
        query = query.filter(models.NoteEntry.is_important == (1 if is_important else 0))

    # Filter by completed status if provided
    if is_completed is not None:
        query = query.filter(models.NoteEntry.is_completed == (1 if is_completed else 0))

    # Order by most recent first
    query = query.order_by(models.NoteEntry.created_at.desc())

    # Limit results to prevent overwhelming response
    results = query.limit(100).all()

    # Build search results with date from daily_note and lists
    search_results = []
    for entry in results:
        # Separate regular lists and kanban columns
        regular_lists = [
            {'id': lst.id, 'name': lst.name, 'is_kanban': bool(lst.is_kanban)}
            for lst in entry.lists
            if not lst.is_kanban
        ]
        kanban_columns = [
            {'id': lst.id, 'name': lst.name, 'is_kanban': bool(lst.is_kanban)} for lst in entry.lists if lst.is_kanban
        ]

        result_dict = {
            'id': entry.id,
            'daily_note_id': entry.daily_note_id,
            'title': entry.title,
            'content': entry.content,
            'content_type': entry.content_type,
            'order_index': entry.order_index,
            'created_at': entry.created_at,
            'updated_at': entry.updated_at,
            'labels': entry.labels,
            'lists': entry.lists,
            'list_names': [lst.name for lst in entry.lists],
            'regular_lists': regular_lists,
            'kanban_columns': kanban_columns,
            'include_in_report': bool(entry.include_in_report),
            'is_important': bool(entry.is_important),
            'is_completed': bool(entry.is_completed),
            'is_pinned': bool(entry.is_pinned),
            'is_archived': bool(entry.is_archived),
            'date': entry.daily_note.date if entry.daily_note else 'Unknown',
        }
        search_results.append(result_dict)

    return search_results


@router.get('/all')
def search_all(
    q: str | None = Query(None, description='Search query for content'),
    label_ids: str | None = Query(None, description='Comma-separated label IDs to filter by'),
    list_ids: str | None = Query(None, description='Comma-separated list IDs to filter by'),
    is_important: bool | None = Query(None, description='Filter by starred/important entries'),
    is_completed: bool | None = Query(None, description='Filter by completed entries'),
    include_archived: bool = Query(False, description='Include archived entries in search results'),
    db: Session = Depends(get_db),
):
    """
    Global search across entries AND lists.
    Returns both entries and lists that match the search criteria.
    """
    print(
        f'Search params: q={q}, label_ids={label_ids}, list_ids={list_ids}, is_important={is_important}, is_completed={is_completed}, include_archived={include_archived}'
    )
    results = {'entries': [], 'lists': []}

    # Search entries
    entry_query = db.query(models.NoteEntry)

    # Filter out archived entries by default
    if not include_archived:
        entry_query = entry_query.filter(models.NoteEntry.is_archived == 0)

    # Filter by text in title or content if provided
    if q and q.strip():
        search_term = f'%{q.strip()}%'
        entry_query = entry_query.filter(
            or_(
                models.NoteEntry.title.ilike(search_term),
                models.NoteEntry.content.ilike(search_term),
            )
        )

    if label_ids and label_ids.strip():
        try:
            label_id_list = [int(lid.strip()) for lid in label_ids.split(',') if lid.strip()]
            if label_id_list:
                # Use exists() subquery to avoid join conflicts
                entry_query = entry_query.filter(models.NoteEntry.labels.any(models.Label.id.in_(label_id_list)))
        except ValueError:
            pass

    # Filter by lists if provided
    if list_ids and list_ids.strip():
        try:
            list_id_list = [int(lid.strip()) for lid in list_ids.split(',') if lid.strip()]
            if list_id_list:
                # Use exists() subquery to avoid join conflicts
                entry_query = entry_query.filter(models.NoteEntry.lists.any(models.List.id.in_(list_id_list)))
        except ValueError:
            pass

    # Filter by starred/important status if provided
    if is_important is not None:
        print(f'Filtering by is_important: {is_important}, converted to: {1 if is_important else 0}')
        entry_query = entry_query.filter(models.NoteEntry.is_important == (1 if is_important else 0))

    # Filter by completed status if provided
    if is_completed is not None:
        print(f'Filtering by is_completed: {is_completed}, converted to: {1 if is_completed else 0}')
        entry_query = entry_query.filter(models.NoteEntry.is_completed == (1 if is_completed else 0))

    # Now add eager loading for relationships and execute
    entry_query = entry_query.options(
        joinedload(models.NoteEntry.labels), joinedload(models.NoteEntry.lists), joinedload(models.NoteEntry.daily_note)
    )

    entry_results = entry_query.order_by(models.NoteEntry.created_at.desc()).limit(100).all()
    print(f'Found {len(entry_results)} entries')

    for entry in entry_results:
        # Separate regular lists and kanban columns
        regular_lists = [
            {'id': lst.id, 'name': lst.name, 'is_kanban': bool(lst.is_kanban)}
            for lst in entry.lists
            if not lst.is_kanban
        ]
        kanban_columns = [
            {'id': lst.id, 'name': lst.name, 'is_kanban': bool(lst.is_kanban)} for lst in entry.lists if lst.is_kanban
        ]

        results['entries'].append(
            {
                'id': entry.id,
                'daily_note_id': entry.daily_note_id,
                'title': entry.title,
                'content': entry.content,
                'content_type': entry.content_type,
                'order_index': entry.order_index,
                'created_at': entry.created_at,
                'updated_at': entry.updated_at,
                'labels': [{'id': label.id, 'name': label.name, 'color': label.color} for label in entry.labels],
                'list_names': [lst.name for lst in entry.lists],
                'regular_lists': regular_lists,
                'kanban_columns': kanban_columns,
                'include_in_report': bool(entry.include_in_report),
                'is_important': bool(entry.is_important),
                'is_completed': bool(entry.is_completed),
                'is_pinned': bool(entry.is_pinned),
                'is_archived': bool(entry.is_archived),
                'date': entry.daily_note.date if entry.daily_note else 'Unknown',
            }
        )

    # Search lists
    list_query = db.query(models.List).options(joinedload(models.List.labels), joinedload(models.List.entries))

    if q and q.strip():
        search_term = f'%{q.strip()}%'
        list_query = list_query.filter(
            (models.List.name.ilike(search_term)) | (models.List.description.ilike(search_term))
        )

    if label_ids and label_ids.strip():
        try:
            label_id_list = [int(lid.strip()) for lid in label_ids.split(',') if lid.strip()]
            if label_id_list:
                list_query = list_query.join(models.List.labels).filter(models.Label.id.in_(label_id_list)).distinct()
        except ValueError:
            pass

    list_results = list_query.order_by(models.List.created_at.desc()).limit(50).all()

    for lst in list_results:
        results['lists'].append(
            {
                'id': lst.id,
                'name': lst.name,
                'description': lst.description,
                'color': lst.color,
                'order_index': lst.order_index,
                'is_archived': bool(lst.is_archived),
                'created_at': lst.created_at,
                'updated_at': lst.updated_at,
                'labels': lst.labels,
                'entry_count': len(lst.entries) if lst.entries else 0,
            }
        )

    return results
