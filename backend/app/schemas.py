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
    # LLM settings
    llm_provider: str | None = None
    openai_api_type: str | None = None
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    gemini_api_key: str | None = None
    llm_global_prompt: str | None = None


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
    # LLM settings (keys masked)
    llm_provider: str = 'openai'
    openai_api_type: str = 'chat_completions'
    openai_api_key_set: bool = False
    anthropic_api_key_set: bool = False
    gemini_api_key_set: bool = False
    llm_global_prompt: str = ''
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


# ===========================
# LLM Integration Schemas
# ===========================


class LlmSettingsUpdate(BaseModel):
    llm_provider: str | None = None  # 'openai', 'anthropic', 'gemini'
    openai_api_type: str | None = None  # 'chat_completions' or 'responses'
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    gemini_api_key: str | None = None
    llm_global_prompt: str | None = None


class LlmSettingsResponse(BaseModel):
    llm_provider: str = 'openai'
    openai_api_type: str = 'chat_completions'  # 'chat_completions' or 'responses'
    openai_api_key_set: bool = False  # True if key is configured (never expose actual key)
    anthropic_api_key_set: bool = False
    gemini_api_key_set: bool = False
    llm_global_prompt: str = ''

    class Config:
        from_attributes = True


class LlmMessage(BaseModel):
    role: str  # 'user', 'assistant', 'system'
    content: str


class LlmSendRequest(BaseModel):
    entry_id: int
    prompt: str  # The selected text / user message
    continue_conversation: bool = True  # Whether to include previous context


class LlmSendResponse(BaseModel):
    response: str  # The AI response text
    conversation_id: int  # The conversation record ID
    provider: str  # The LLM provider used (openai, anthropic, gemini)
    input_tokens: int  # Number of input/prompt tokens used
    output_tokens: int  # Number of output/completion tokens used


class LlmConversationResponse(BaseModel):
    id: int
    entry_id: int
    messages: list[LlmMessage]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===========================
# MCP Server Schemas
# ===========================


class McpRoutingRuleBase(BaseModel):
    pattern: str
    priority: int = 0
    is_enabled: bool = True


class McpRoutingRuleCreate(McpRoutingRuleBase):
    mcp_server_id: int


class McpRoutingRuleUpdate(BaseModel):
    pattern: str | None = None
    priority: int | None = None
    is_enabled: bool | None = None


class McpRoutingRuleResponse(McpRoutingRuleBase):
    id: int
    mcp_server_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class McpServerBase(BaseModel):
    name: str
    server_type: str = 'docker'  # 'docker' or 'remote'
    transport_type: str = 'http'  # 'http' or 'stdio'
    # Docker-specific fields
    image: str = ''
    port: int = 0  # Not required for stdio transport
    # Dockerfile build fields
    build_source: str = 'image'  # 'image' or 'dockerfile'
    build_context: str = ''  # Path to directory containing Dockerfile
    dockerfile_path: str = ''  # Optional: relative path to Dockerfile
    # Remote-specific fields
    url: str = ''
    headers: dict[str, str] = {}  # HTTP headers for authentication
    # Common fields
    description: str = ''
    color: str = '#22c55e'  # Hex color for UI indicator
    env_vars: list[str] = []
    auto_start: bool = False


class McpServerCreate(McpServerBase):
    pass


class McpServerUpdate(BaseModel):
    name: str | None = None
    server_type: str | None = None
    transport_type: str | None = None  # 'http' or 'stdio'
    image: str | None = None
    port: int | None = None
    build_source: str | None = None
    build_context: str | None = None
    dockerfile_path: str | None = None
    url: str | None = None
    headers: dict[str, str] | None = None
    description: str | None = None
    color: str | None = None
    env_vars: list[str] | None = None
    auto_start: bool | None = None


class McpServerResponse(McpServerBase):
    id: int
    status: str = 'stopped'
    last_health_check: datetime | None = None
    source: str = 'local'
    manifest_url: str = ''
    created_at: datetime
    updated_at: datetime
    routing_rules: list[McpRoutingRuleResponse] = []

    class Config:
        from_attributes = True


class McpServerLogsResponse(BaseModel):
    server_id: int
    server_name: str
    logs: str
    timestamp: datetime


class McpDockerStatusResponse(BaseModel):
    available: bool
    version: str | None = None
    error: str | None = None


class McpSettingsResponse(BaseModel):
    mcp_enabled: bool = False
    mcp_idle_timeout: int = 300
    mcp_fallback_to_llm: bool = True
    docker_available: bool = False


class McpSettingsUpdate(BaseModel):
    mcp_enabled: bool | None = None
    mcp_idle_timeout: int | None = None
    mcp_fallback_to_llm: bool | None = None


class McpManifestImport(BaseModel):
    manifest_url: str


class McpProcessRequest(BaseModel):
    input: str
    rules: str = ''
    context: dict = {}


class McpProcessResponse(BaseModel):
    output: str
    metadata: dict = {}


# ===========================
# Jupyter Integration Schemas
# ===========================


class JupyterStatusResponse(BaseModel):
    docker_available: bool
    container_running: bool
    kernel_id: str | None = None
    error: str | None = None


class JupyterSettingsResponse(BaseModel):
    jupyter_enabled: bool = False
    jupyter_auto_start: bool = False
    jupyter_python_version: str = '3.11'
    jupyter_custom_image: str = ''
    docker_available: bool = False


class JupyterSettingsUpdate(BaseModel):
    jupyter_enabled: bool | None = None
    jupyter_auto_start: bool | None = None
    jupyter_python_version: str | None = None
    jupyter_custom_image: str | None = None


class JupyterExecuteRequest(BaseModel):
    code: str


class JupyterOutput(BaseModel):
    type: str  # 'stdout', 'stderr', 'display_data', 'execute_result', 'error'
    text: str | None = None
    data: dict | None = None  # For rich outputs (images, HTML, etc.)
    mime_type: str | None = None


class JupyterExecuteResponse(BaseModel):
    outputs: list[JupyterOutput] = []
    execution_count: int = 0
    status: str = 'ok'  # 'ok' or 'error'
    error_name: str | None = None
    error_value: str | None = None
    traceback: list[str] | None = None


class JupyterStartResponse(BaseModel):
    success: bool
    kernel_id: str | None = None
    error: str | None = None


class JupyterStopResponse(BaseModel):
    success: bool
    error: str | None = None


class JupyterLogsResponse(BaseModel):
    logs: str


class JupyterExportCell(BaseModel):
    code: str
    outputs: list[dict] = []
    execution_count: int | None = None


class JupyterExportRequest(BaseModel):
    cells: list[JupyterExportCell]
    filename: str = 'notebook.ipynb'


# New mixed export schemas for code + markdown cells
class JupyterExportNode(BaseModel):
    type: str  # 'code' or 'markdown'
    content: str
    execution_count: int | None = None
    outputs: list[dict] = []


class JupyterMixedExportRequest(BaseModel):
    nodes: list[JupyterExportNode]
    filename: str = 'notebook.ipynb'


# Import response schema
class JupyterImportNode(BaseModel):
    type: str  # 'notebookCell', 'heading', 'paragraph', etc.
    attrs: dict | None = None
    content: list[dict] | None = None


class JupyterImportResponse(BaseModel):
    nodes: list[JupyterImportNode]
    filename: str


class JupyterImportUrlRequest(BaseModel):
    url: str
    pyproject_url: str | None = None  # Optional URL/path to pyproject.toml for dependencies
