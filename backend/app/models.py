from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship

from app.database import Base

# Association table for many-to-many relationship between notes and labels
note_labels = Table(
    'note_labels',
    Base.metadata,
    Column('note_id', Integer, ForeignKey('daily_notes.id', ondelete='CASCADE')),
    Column('label_id', Integer, ForeignKey('labels.id', ondelete='CASCADE')),
)

# Association table for many-to-many relationship between entries and labels
entry_labels = Table(
    'entry_labels',
    Base.metadata,
    Column('entry_id', Integer, ForeignKey('note_entries.id', ondelete='CASCADE')),
    Column('label_id', Integer, ForeignKey('labels.id', ondelete='CASCADE')),
)

# Association table for many-to-many relationship between entries and lists
entry_lists = Table(
    'entry_lists',
    Base.metadata,
    Column('entry_id', Integer, ForeignKey('note_entries.id', ondelete='CASCADE')),
    Column('list_id', Integer, ForeignKey('lists.id', ondelete='CASCADE')),
    Column('order_index', Integer, default=0),  # For ordering entries within a list
    Column('created_at', DateTime, default=datetime.utcnow),
)

# Association table for many-to-many relationship between lists and labels
list_labels = Table(
    'list_labels',
    Base.metadata,
    Column('list_id', Integer, ForeignKey('lists.id', ondelete='CASCADE')),
    Column('label_id', Integer, ForeignKey('labels.id', ondelete='CASCADE')),
)


class Label(Base):
    """Model for labels"""

    __tablename__ = 'labels'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    color = Column(String, default='#3b82f6')  # Hex color code
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    notes = relationship('DailyNote', secondary=note_labels, back_populates='labels')
    entries = relationship('NoteEntry', secondary=entry_labels, back_populates='labels')
    lists = relationship('List', secondary=list_labels, back_populates='labels')


class List(Base):
    """Model for lists - Trello-style boards for organizing note entries"""

    __tablename__ = 'lists'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, default='')
    color = Column(String, default='#3b82f6')  # Hex color code
    order_index = Column(Integer, default=0)  # For ordering lists
    is_archived = Column(Integer, default=0)  # 0 = false, 1 = true (for SQLite compatibility)
    is_kanban = Column(Integer, default=0)  # 0 = false, 1 = true (Kanban board column)
    kanban_order = Column(Integer, default=0)  # For ordering Kanban columns
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    entries = relationship('NoteEntry', secondary=entry_lists, back_populates='lists')
    labels = relationship('Label', secondary=list_labels, back_populates='lists')


class AppSettings(Base):
    """Model for application settings - single row table for persistent settings"""

    __tablename__ = 'app_settings'

    id = Column(Integer, primary_key=True, index=True)
    sprint_goals = Column(Text, default='')  # Persistent sprint goals
    quarterly_goals = Column(Text, default='')  # Persistent quarterly goals
    sprint_start_date = Column(String, default='')  # Format: YYYY-MM-DD
    sprint_end_date = Column(String, default='')  # Format: YYYY-MM-DD
    quarterly_start_date = Column(String, default='')  # Format: YYYY-MM-DD
    quarterly_end_date = Column(String, default='')  # Format: YYYY-MM-DD
    emoji_library = Column(String, default='emoji-picker-react')  # Emoji picker library preference
    sprint_name = Column(String, default='Sprint')  # Custom name for sprint goals
    daily_goal_end_time = Column(String, default='17:00')  # End time for daily goal countdown (HH:MM format)
    texture_enabled = Column(Integer, default=0)  # UI texture system enabled (0/1 as boolean)
    texture_settings = Column(Text, default='{}')  # JSON string for texture configuration
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SprintGoal(Base):
    """Model for sprint goals with date ranges - supports historical tracking"""

    __tablename__ = 'sprint_goals'

    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False, default='')
    start_date = Column(String, nullable=False)  # Format: YYYY-MM-DD
    end_date = Column(String, nullable=False)  # Format: YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class QuarterlyGoal(Base):
    """Model for quarterly goals with date ranges - supports historical tracking"""

    __tablename__ = 'quarterly_goals'

    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False, default='')
    start_date = Column(String, nullable=False)  # Format: YYYY-MM-DD
    end_date = Column(String, nullable=False)  # Format: YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DailyNote(Base):
    """Model for daily notes - one per day"""

    __tablename__ = 'daily_notes'

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, unique=True, index=True, nullable=False)  # Format: YYYY-MM-DD
    fire_rating = Column(Integer, default=0)  # 0-5 fire rating
    daily_goal = Column(Text, default='')  # Daily goal/objective (refreshes daily)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    entries = relationship(
        'NoteEntry',
        back_populates='daily_note',
        cascade='all, delete-orphan',
        order_by='[desc(NoteEntry.order_index), desc(NoteEntry.created_at)]',
    )
    labels = relationship('Label', secondary=note_labels, back_populates='notes')


class NoteEntry(Base):
    """Model for individual content entries within a day"""

    __tablename__ = 'note_entries'

    id = Column(Integer, primary_key=True, index=True)
    daily_note_id = Column(Integer, ForeignKey('daily_notes.id'), nullable=False)
    title = Column(String, default='')  # Optional title for the entry
    content = Column(Text, nullable=False)  # Rich text content (HTML)
    content_type = Column(String, default='rich_text')  # rich_text, code, markdown
    order_index = Column(Integer, default=0)  # For ordering entries within a day
    include_in_report = Column(Integer, default=0)  # 0 = false, 1 = true (for SQLite compatibility)
    is_important = Column(Integer, default=0)  # 0 = false, 1 = true (starred/important)
    is_completed = Column(Integer, default=0)  # 0 = false, 1 = true (completed checkbox)
    is_dev_null = Column(Integer, default=0)  # 0 = false, 1 = true (marked as /dev/null - discarded)
    is_pinned = Column(Integer, default=0)  # 0 = false, 1 = true (pinned - auto-copy to next day)
    is_archived = Column(Integer, default=0)  # 0 = false, 1 = true (archived - hidden from views)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    daily_note = relationship('DailyNote', back_populates='entries')
    labels = relationship('Label', secondary=entry_labels, back_populates='entries')
    lists = relationship('List', secondary=entry_lists, back_populates='entries')
    reminder = relationship(
        'Reminder',
        back_populates='entry',
        uselist=False,
        cascade='all, delete-orphan',
        primaryjoin='and_(NoteEntry.id==Reminder.entry_id, Reminder.is_dismissed==0)',
    )


class Reminder(Base):
    """Model for reminders - date-time based alerts for note entries"""

    __tablename__ = 'reminders'

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey('note_entries.id', ondelete='CASCADE'), nullable=False)
    reminder_datetime = Column(String, nullable=False)  # ISO format datetime string
    is_dismissed = Column(Integer, default=0)  # 0 = false, 1 = true (for SQLite compatibility)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    entry = relationship('NoteEntry', back_populates='reminder')


class SearchHistory(Base):
    """Model for search history"""

    __tablename__ = 'search_history'

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class CustomEmoji(Base):
    """Model for custom user-uploaded emojis"""

    __tablename__ = 'custom_emojis'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)  # Shortcode like :custom_smile:
    image_url = Column(String, nullable=False)  # Path to uploaded image
    category = Column(String, default='Custom')  # Category for organization
    keywords = Column(String, default='')  # Comma-separated keywords for search
    is_deleted = Column(Integer, default=0)  # 0 = false, 1 = true (soft delete for backward compatibility)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
