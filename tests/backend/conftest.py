"""
Shared pytest fixtures for backend tests.
"""

import os
import sys
import tempfile
from collections.abc import Generator
from datetime import datetime

import pytest
import sqlalchemy
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

# Set testing mode to prevent main.py from creating tables on production DB
os.environ['TESTING'] = 'true'

# Add backend directory to path for imports
# In Docker: /app (backend code) is mounted, we're in /tests
# Locally: ../../backend/ from tests/backend/
backend_path = os.getenv(
    'BACKEND_PATH', os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
)
sys.path.insert(0, backend_path)

# Import the entire models module to ensure all tables (including association tables) are registered
from app import models  # noqa: E402, F401
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    AppSettings,
    DailyNote,
    Label,
    NoteEntry,
    QuarterlyGoal,
    SprintGoal,
    entry_labels,
    entry_lists,
    list_labels,
    note_labels,
)


@pytest.fixture(scope='function')
def db_engine():
    """Create a shared test database engine."""
    # Use a file-based database with WAL mode to avoid locking issues
    import tempfile

    fd, db_path = tempfile.mkstemp(suffix='.db')
    os.close(fd)

    engine = create_engine(
        f'sqlite:///{db_path}',
        connect_args={'check_same_thread': False},
        poolclass=NullPool,
    )

    # Explicitly reference association tables to ensure they're registered
    _ = (entry_labels, entry_lists, list_labels, note_labels)

    # Create all tables (models module is imported above, ensuring all tables are registered)
    Base.metadata.create_all(bind=engine)

    # Enable WAL mode for better concurrency
    with engine.connect() as conn:
        conn.execute(sqlalchemy.text('PRAGMA journal_mode=WAL'))
        conn.commit()

    yield engine

    Base.metadata.drop_all(bind=engine)
    engine.dispose()

    # Clean up the temp file
    if os.path.exists(db_path):
        os.unlink(db_path)


@pytest.fixture(scope='function')
def db_session(db_engine) -> Generator[Session, None, None]:
    """Create a new database session for testing."""
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = testing_session_local()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(scope='function')
def client(db_session, db_engine):
    """Create a FastAPI test client with the test database."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    # Ensure tables exist before using client
    Base.metadata.create_all(bind=db_engine)

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_label(db_session) -> Label:
    """Create a sample label."""
    label = Label(name='Test Label', color='#3b82f6')
    db_session.add(label)
    db_session.commit()
    db_session.refresh(label)
    return label


@pytest.fixture
def sample_emoji_label(db_session) -> Label:
    """Create a sample emoji label."""
    label = Label(name='🔥', color='#ff0000')
    db_session.add(label)
    db_session.commit()
    db_session.refresh(label)
    return label


@pytest.fixture
def sample_daily_note(db_session) -> DailyNote:
    """Create a sample daily note."""
    note = DailyNote(date='2025-11-07', fire_rating=3, daily_goal='Complete the test suite')
    db_session.add(note)
    db_session.commit()
    db_session.refresh(note)
    return note


@pytest.fixture
def sample_note_entry(db_session, sample_daily_note) -> NoteEntry:
    """Create a sample note entry."""
    entry = NoteEntry(
        daily_note_id=sample_daily_note.id,
        title='Test Entry',
        content='<p>This is a test entry.</p>',
        content_type='rich_text',
        is_important=0,
        is_completed=0,
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)
    return entry


@pytest.fixture
def sample_note_entry_with_labels(db_session, sample_daily_note, sample_label) -> NoteEntry:
    """Create a sample note entry with labels."""
    entry = NoteEntry(
        daily_note_id=sample_daily_note.id,
        title='Entry with Labels',
        content='<p>Entry with labels attached.</p>',
        content_type='rich_text',
    )
    entry.labels.append(sample_label)
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)
    return entry


@pytest.fixture
def sample_sprint_goal(db_session) -> SprintGoal:
    """Create a sample sprint goal."""
    goal = SprintGoal(text='Complete feature X', start_date='2025-11-01', end_date='2025-11-14')
    db_session.add(goal)
    db_session.commit()
    db_session.refresh(goal)
    return goal


@pytest.fixture
def sample_quarterly_goal(db_session) -> QuarterlyGoal:
    """Create a sample quarterly goal."""
    goal = QuarterlyGoal(text='Launch product Y', start_date='2025-10-01', end_date='2025-12-31')
    db_session.add(goal)
    db_session.commit()
    db_session.refresh(goal)
    return goal


@pytest.fixture
def sample_app_settings(db_session) -> AppSettings:
    """Create sample app settings."""
    settings = AppSettings(
        sprint_goals='Old sprint goals',
        quarterly_goals='Old quarterly goals',
        sprint_start_date='2025-11-01',
        sprint_end_date='2025-11-14',
        quarterly_start_date='2025-10-01',
        quarterly_end_date='2025-12-31',
    )
    db_session.add(settings)
    db_session.commit()
    db_session.refresh(settings)
    return settings


@pytest.fixture
def multiple_entries(db_session, sample_daily_note) -> list[NoteEntry]:
    """Create multiple note entries for testing."""
    entries = []
    for i in range(5):
        entry = NoteEntry(
            daily_note_id=sample_daily_note.id,
            title=f'Entry {i+1}',
            content=f'<p>Content for entry {i+1}</p>',
            order_index=i,
            is_important=1 if i % 2 == 0 else 0,
            is_completed=1 if i % 3 == 0 else 0,
        )
        entries.append(entry)
        db_session.add(entry)
    db_session.commit()
    for entry in entries:
        db_session.refresh(entry)
    return entries


@pytest.fixture
def temp_db_file():
    """Create a temporary database file for migration testing."""
    fd, path = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def fixed_datetime():
    """Return a fixed datetime for consistent testing."""
    return datetime(2025, 11, 7, 12, 0, 0)
