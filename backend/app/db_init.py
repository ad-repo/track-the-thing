"""
Utility to ensure the SQLite database exists with the latest schema and defaults.
"""

import os
from pathlib import Path

from sqlalchemy.orm import Session

from app import models
from app.database import Base, engine


def _resolve_db_path() -> Path:
    """Derive the SQLite database path from DATABASE_URL (supports sqlite only)."""
    database_url = os.getenv('DATABASE_URL', 'sqlite:///./daily_notes.db')

    if not database_url.startswith('sqlite:///'):
        raise ValueError('Only sqlite DATABASE_URL values are supported when auto-initializing the DB.')

    path_part = database_url[len('sqlite:///') :]
    if path_part.startswith('./'):
        path_part = path_part[2:]

    db_path = Path(path_part)
    if not db_path.is_absolute():
        db_path = Path.cwd() / db_path
    return db_path


def ensure_database() -> Path:
    """Create the SQLite file, schema, and default settings row if missing."""
    db_path = _resolve_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    Base.metadata.create_all(bind=engine)

    try:
        with Session(engine) as session:
            settings = session.query(models.AppSettings).filter(models.AppSettings.id == 1).first()
            if not settings:
                settings = models.AppSettings(
                    id=1,
                    sprint_goals='',
                    quarterly_goals='',
                    sprint_start_date='',
                    sprint_end_date='',
                    quarterly_start_date='',
                    quarterly_end_date='',
                    emoji_library='emoji-picker-react',
                    sprint_name='Sprint',
                    daily_goal_end_time='17:00',
                )
                session.add(settings)
                session.commit()
    except Exception as e:
        # If querying fails (e.g. missing columns), migrations will handle it
        print(f'Note: Could not initialize AppSettings (migrations may be needed): {e}')

    print(f'✓ Database ready at {db_path}')
    return db_path


if __name__ == '__main__':
    ensure_database()
