from types import SimpleNamespace

import pytest

from app.routers import search


class FakeList:
    def __init__(self, list_id: int, name: str, is_kanban: bool):
        self.id = list_id
        self.name = name
        self.is_kanban = is_kanban


class FakeQuery:
    def __init__(self, results):
        self.results = results
        self.filters = []
        self.joins = []
        self.options_called = False
        self.order_by_called = False
        self.limit_value = None

    def options(self, *args, **kwargs):
        self.options_called = True
        return self

    def filter(self, *args, **kwargs):
        self.filters.append(args)
        return self

    def join(self, *args, **kwargs):
        self.joins.append(args)
        return self

    def order_by(self, *args, **kwargs):
        self.order_by_called = True
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def all(self):
        return self.results


class FakeDB:
    def __init__(self, query_obj):
        self.query_obj = query_obj

    def query(self, *args, **kwargs):
        return self.query_obj


@pytest.mark.unit
def test_search_entries_orders_limits_and_splits_kanban():
    entry = SimpleNamespace(
        id=1,
        daily_note_id=10,
        title='Kanban Entry',
        content='Test content',
        content_type='rich_text',
        order_index=0,
        created_at='2025-11-07T00:00:00Z',
        updated_at='2025-11-07T00:00:00Z',
        labels=[],
        lists=[FakeList(1, 'Work', False), FakeList(2, 'Doing', True)],
        include_in_report=0,
        is_important=1,
        is_completed=0,
        is_pinned=0,
        is_archived=0,
        daily_note=SimpleNamespace(date='2025-11-07'),
    )
    query = FakeQuery([entry])
    db = FakeDB(query)

    results = search.search_entries(q=None, label_ids='1,2', list_ids=None, include_archived=False, db=db)  # type: ignore[arg-type]

    assert len(results) == 1
    result = results[0]
    assert len(result['regular_lists']) == 1
    assert len(result['kanban_columns']) == 1
    assert query.order_by_called is True
    assert query.limit_value == 100
    assert query.options_called is True
    assert query.joins, 'label filter should join labels when ids provided'
    # include_archived=False should add a filter
    assert len(query.filters) >= 1


@pytest.mark.unit
def test_search_entries_ignores_invalid_label_ids():
    query = FakeQuery([])
    db = FakeDB(query)

    results = search.search_entries(q=None, label_ids='abc', list_ids=None, include_archived=True, db=db)  # type: ignore[arg-type]

    assert results == []
    assert query.limit_value == 100
    # include_archived=True should not add the archived filter
    assert query.filters == []
    assert query.joins == []
