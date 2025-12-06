from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


# Label Schemas
class LabelBase(BaseModel):
    name: str
    color: str = '#3b82f6'


class LabelCreate(LabelBase):
    pass


class Label(LabelBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ===========================
# List Schemas (Trello-style boards) - Must be before NoteEntry
# ===========================


class ListBase(BaseModel):
    name: str
    description: str = ''
    color: str = '#3b82f6'
    order_index: int = 0
    is_archived: bool = False
    is_kanban: bool = False
    kanban_order: int = 0


class ListCreate(ListBase):
    pass


class ListUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    order_index: int | None = None
    is_archived: bool | None = None
    is_kanban: bool | None = None
    kanban_order: int | None = None


class ListResponse(ListBase):
    id: int
    created_at: datetime
    updated_at: datetime
    entry_count: int = 0  # Calculated field
    labels: list[Label] = []

    class Config:
        from_attributes = True


class EntryListAssociation(BaseModel):
    entry_id: int
    list_id: int
    order_index: int = 0


class ReorderEntriesRequest(BaseModel):
    entries: list[EntryListAssociation]


class ListOrderUpdate(BaseModel):
    id: int
    order_index: int


class ReorderListsRequest(BaseModel):
    lists: list[ListOrderUpdate]


# Reminder Schemas (defined before NoteEntry to avoid forward reference issues)
class ReminderBase(BaseModel):
    entry_id: int
    reminder_datetime: str  # ISO format datetime string
    is_dismissed: bool = False


class ReminderCreate(BaseModel):
    entry_id: int
    reminder_datetime: str  # ISO format datetime string


class ReminderUpdate(BaseModel):
    reminder_datetime: str | None = None
    is_dismissed: bool | None = None


class ReminderResponse(ReminderBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Simplified entry info for reminders (to avoid circular reference)
class ReminderEntryInfo(BaseModel):
    id: int
    daily_note_id: int
    daily_note_date: str | None = None
    title: str
    content: str
    content_type: str

    class Config:
        from_attributes = True


# Reminder with entry details (used when fetching reminders directly)
class ReminderWithEntry(ReminderResponse):
    entry: ReminderEntryInfo | None = None


# Entry Schemas
class NoteEntryBase(BaseModel):
    title: str = ''
    content: str
    content_type: str = 'rich_text'
    order_index: int = 0


class NoteEntryCreate(NoteEntryBase):
    pass


class NoteEntryUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    content_type: str | None = None
    order_index: int | None = None
    include_in_report: bool | None = None
    is_important: bool | None = None
    is_completed: bool | None = None
    is_pinned: bool | None = None
    is_archived: bool | None = None


class NoteEntry(NoteEntryBase):
    id: int
    daily_note_id: int
    daily_note_date: str | None = None  # YYYY-MM-DD format for navigation
    created_at: datetime
    updated_at: datetime
    labels: list[Label] = []
    lists: list[ListResponse] = []
    include_in_report: bool = False
    is_important: bool = False
    is_completed: bool = False
    is_pinned: bool = False
    is_archived: bool = False
    reminder: ReminderResponse | None = None

    class Config:
        from_attributes = True


# ListWithEntries - defined after NoteEntry due to forward reference
class ListWithEntries(ListResponse):
    entries: list[NoteEntry] = []

    class Config:
        from_attributes = True


# Daily Note Schemas
class DailyNoteBase(BaseModel):
    date: str  # Format: YYYY-MM-DD
    fire_rating: int = Field(default=0, ge=0, le=5)
    daily_goal: str = ''


class DailyNoteCreate(DailyNoteBase):
    pass


class DailyNoteUpdate(BaseModel):
    fire_rating: int | None = Field(default=None, ge=0, le=5)
    daily_goal: str | None = None


class DailyNote(DailyNoteBase):
    id: int
    created_at: datetime
    updated_at: datetime
    entries: list[NoteEntry] = []
    labels: list[Label] = []

    class Config:
        from_attributes = True


# Response models
class DailyNoteWithEntries(DailyNote):
    pass


# Link Preview Schemas
class LinkPreviewResponse(BaseModel):
    url: str
    title: str | None = None
    description: str | None = None
    image: str | None = None
    site_name: str | None = None


# Report Schemas
class ReportEntry(BaseModel):
    date: str
    content: str
    labels: list[Label]
    entry_id: int
    is_completed: bool


class WeeklyReport(BaseModel):
    week_start: str
    week_end: str
    generated_at: datetime
    entries: list[ReportEntry]


# Merge Schemas
class MergeEntriesRequest(BaseModel):
    entry_ids: list[int]
    separator: str = '\n\n'
    delete_originals: bool = True


# Search Schemas
class SearchResult(NoteEntryBase):
    id: int
    daily_note_id: int
    date: str  # Date of the daily note
    created_at: datetime
    updated_at: datetime
    labels: list[Label] = []
    lists: list[ListResponse] = []
    list_names: list[str] = []
    include_in_report: bool = False
    is_important: bool = False
    is_completed: bool = False
    is_pinned: bool = False
    is_archived: bool = False

    class Config:
        from_attributes = True


# App Settings Schemas
class AppSettingsUpdate(BaseModel):
    sprint_goals: str | None = None
    quarterly_goals: str | None = None
    sprint_start_date: str | None = None
    sprint_end_date: str | None = None
    quarterly_start_date: str | None = None
    quarterly_end_date: str | None = None
    emoji_library: str | None = None
    sprint_name: str | None = None
    daily_goal_end_time: str | None = None
    texture_enabled: bool | None = None
    texture_settings: str | None = None


class AppSettingsResponse(BaseModel):
    id: int
    sprint_goals: str
    quarterly_goals: str
    sprint_start_date: str
    sprint_end_date: str
    quarterly_start_date: str
    quarterly_end_date: str
    emoji_library: str = 'emoji-picker-react'
    sprint_name: str = 'Sprint'
    daily_goal_end_time: str = '17:00'
    texture_enabled: bool = False
    texture_settings: str = '{}'
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# Goal Schemas
class GoalBase(BaseModel):
    text: str
    start_date: str  # Format: YYYY-MM-DD
    end_date: str  # Format: YYYY-MM-DD


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    text: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class GoalResponse(GoalBase):
    id: int
    created_at: datetime
    updated_at: datetime
    days_remaining: int | None = None  # Calculated field, relative to queried date

    class Config:
        from_attributes = True


# Unified Goal Schemas (new flexible goals system)
class UnifiedGoalBase(BaseModel):
    name: str
    goal_type: str  # "Daily", "Sprint", "Fitness", "Custom:TypeName"
    text: str = ''
    start_date: str | None = None  # YYYY-MM-DD (optional for lifestyle goals)
    end_date: str | None = None  # YYYY-MM-DD (optional for lifestyle goals)
    end_time: str = ''  # HH:MM (optional, for daily goals)
    status_text: str = ''  # Custom badge text
    show_countdown: bool = True
    is_visible: bool = True
    order_index: int = 0


class UnifiedGoalCreate(UnifiedGoalBase):
    pass


class UnifiedGoalUpdate(BaseModel):
    name: str | None = None
    goal_type: str | None = None
    text: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    end_time: str | None = None
    status_text: str | None = None
    show_countdown: bool | None = None
    is_completed: bool | None = None
    is_visible: bool | None = None
    order_index: int | None = None


class UnifiedGoalResponse(BaseModel):
    id: int
    name: str
    goal_type: str
    text: str = ''
    start_date: str | None = None
    end_date: str | None = None
    end_time: str = ''
    status_text: str = ''
    show_countdown: bool = True
    is_visible: bool = True
    order_index: int = 0
    is_completed: bool = False
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    days_remaining: int | None = None  # Calculated field

    class Config:
        from_attributes = True


# Custom Emoji Schemas
class CustomEmojiBase(BaseModel):
    name: str  # Shortcode like :custom_smile:
    image_url: str
    category: str = 'Custom'
    keywords: str = ''


class CustomEmojiCreate(BaseModel):
    name: str
    category: str = 'Custom'
    keywords: str = ''


class CustomEmojiUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    keywords: str | None = None


class CustomEmojiResponse(CustomEmojiBase):
    id: int
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
