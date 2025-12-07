from datetime import datetime
from types import SimpleNamespace

import pytest

from app.routers import reports


class FakeQuery:
    def __init__(self, results):
        self.results = results
        self.filters = []
        self.ordered = False

    def filter(self, *args, **kwargs):
        self.filters.append(args)
        return self

    def order_by(self, *args, **kwargs):
        self.ordered = True
        return self

    def all(self):
        return self.results


class FakeDB:
    def __init__(self, query_obj):
        self.query_obj = query_obj

    def query(self, *args, **kwargs):
        return self.query_obj


def make_note(date_str: str, entries):
    return SimpleNamespace(date=date_str, entries=entries)


def make_entry(entry_id: int, include: bool, labels=None):
    return SimpleNamespace(
        id=entry_id,
        include_in_report=1 if include else 0,
        content='Body',
        content_type='rich_text',
        labels=labels or [],
        created_at=datetime(2025, 11, 7),
        is_completed=0,
        is_important=1,
    )


@pytest.mark.unit
def test_get_week_bounds_anchors_on_wednesday():
    date = datetime(2025, 11, 4)  # Tuesday
    start, end = reports.get_week_bounds(date)

    assert start.strftime('%Y-%m-%d') == '2025-10-29'  # previous Wednesday
    assert end.strftime('%Y-%m-%d') == '2025-11-05'


@pytest.mark.unit
def test_generate_report_filters_include_in_report_entries():
    entry_keep = make_entry(1, include=True, labels=[SimpleNamespace(name='work', color='#123456')])
    entry_skip = make_entry(2, include=False)
    notes = [make_note('2025-11-01', [entry_keep, entry_skip])]
    query = FakeQuery(results=notes)
    db = FakeDB(query)

    report = reports.generate_report(date='2025-11-02', db=db)  # type: ignore[arg-type]

    assert report['week_start'] == '2025-10-29'
    assert report['week_end'] == '2025-11-04'
    assert len(report['entries']) == 1
    assert report['entries'][0]['entry_id'] == 1
    assert report['entries'][0]['labels'][0]['name'] == 'work'
    assert query.ordered is True


@pytest.mark.unit
def test_get_available_weeks_aggregates_unique_weeks():
    entries = [
        SimpleNamespace(daily_note=SimpleNamespace(date='2025-11-03')),
        SimpleNamespace(daily_note=SimpleNamespace(date='2025-11-10')),
    ]
    query = FakeQuery(results=entries)
    db = FakeDB(query)

    weeks = reports.get_available_weeks(db=db)  # type: ignore[arg-type]

    assert len(weeks['weeks']) == 2
    labels = [w['label'] for w in weeks['weeks']]
    assert '2025-10-29 to 2025-11-04' in labels
    assert '2025-11-05 to 2025-11-11' in labels
