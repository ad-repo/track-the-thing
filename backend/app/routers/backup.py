import io
import json
import os
import re
from datetime import datetime
from html import unescape

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.storage_paths import get_upload_dir

router = APIRouter()
UPLOAD_DIR = get_upload_dir()


@router.get('/export')
async def export_data(db: Session = Depends(get_db)):
    """Export all data as JSON"""

    # Get all notes with entries and labels
    notes = db.query(models.DailyNote).all()
    labels = db.query(models.Label).all()
    lists = db.query(models.List).all()
    custom_emojis = db.query(models.CustomEmoji).all()
    reminders = db.query(models.Reminder).all()
    search_history = db.query(models.SearchHistory).order_by(models.SearchHistory.created_at.desc()).all()
    app_settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()
    sprint_goals = db.query(models.SprintGoal).all()
    quarterly_goals = db.query(models.QuarterlyGoal).all()
    goals = db.query(models.Goal).all()
    llm_conversations = db.query(models.LlmConversation).all()
    mcp_servers = db.query(models.McpServer).all()
    mcp_routing_rules = db.query(models.McpRoutingRule).all()

    export_data = {
        'version': '10.0',
        'exported_at': datetime.utcnow().isoformat(),
        'search_history': [{'query': item.query, 'created_at': item.created_at.isoformat()} for item in search_history],
        'labels': [
            {'id': label.id, 'name': label.name, 'color': label.color, 'created_at': label.created_at.isoformat()}
            for label in labels
        ],
        'lists': [
            {
                'id': lst.id,
                'name': lst.name,
                'description': lst.description,
                'color': lst.color,
                'order_index': lst.order_index,
                'is_archived': bool(lst.is_archived),
                'is_kanban': bool(lst.is_kanban),
                'kanban_order': lst.kanban_order,
                'created_at': lst.created_at.isoformat(),
                'updated_at': lst.updated_at.isoformat(),
            }
            for lst in lists
        ],
        'custom_emojis': [
            {
                'id': emoji.id,
                'name': emoji.name,
                'image_url': emoji.image_url,
                'category': emoji.category,
                'keywords': emoji.keywords,
                'is_deleted': bool(emoji.is_deleted),
                'created_at': emoji.created_at.isoformat(),
                'updated_at': emoji.updated_at.isoformat(),
            }
            for emoji in custom_emojis
        ],
        'reminders': [
            {
                'id': reminder.id,
                'entry_id': reminder.entry_id,
                'reminder_datetime': reminder.reminder_datetime,
                'is_dismissed': bool(reminder.is_dismissed),
                'created_at': reminder.created_at.isoformat(),
                'updated_at': reminder.updated_at.isoformat(),
            }
            for reminder in reminders
        ],
        'app_settings': {
            'sprint_goals': app_settings.sprint_goals if app_settings else '',
            'quarterly_goals': app_settings.quarterly_goals if app_settings else '',
            'sprint_start_date': app_settings.sprint_start_date if app_settings else '',
            'sprint_end_date': app_settings.sprint_end_date if app_settings else '',
            'quarterly_start_date': app_settings.quarterly_start_date if app_settings else '',
            'quarterly_end_date': app_settings.quarterly_end_date if app_settings else '',
            'emoji_library': app_settings.emoji_library if app_settings else 'emoji-picker-react',
            'sprint_name': getattr(app_settings, 'sprint_name', 'Sprint') if app_settings else 'Sprint',
            'daily_goal_end_time': getattr(app_settings, 'daily_goal_end_time', '17:00') if app_settings else '17:00',
            'texture_enabled': bool(app_settings.texture_enabled) if app_settings else False,
            'texture_settings': app_settings.texture_settings if app_settings else '{}',
            'llm_provider': getattr(app_settings, 'llm_provider', 'openai') if app_settings else 'openai',
            'openai_api_type': getattr(app_settings, 'openai_api_type', 'chat_completions')
            if app_settings
            else 'chat_completions',
            'llm_global_prompt': getattr(app_settings, 'llm_global_prompt', '') if app_settings else '',
            # MCP settings
            'mcp_enabled': bool(getattr(app_settings, 'mcp_enabled', 0)) if app_settings else False,
            'mcp_idle_timeout': getattr(app_settings, 'mcp_idle_timeout', 300) if app_settings else 300,
            'mcp_fallback_to_llm': bool(getattr(app_settings, 'mcp_fallback_to_llm', 1)) if app_settings else True,
            # Jupyter settings
            'jupyter_enabled': bool(getattr(app_settings, 'jupyter_enabled', 0)) if app_settings else False,
            'jupyter_auto_start': bool(getattr(app_settings, 'jupyter_auto_start', 0)) if app_settings else False,
            'jupyter_python_version': getattr(app_settings, 'jupyter_python_version', '3.11') or '3.11'
            if app_settings
            else '3.11',
            'jupyter_custom_image': getattr(app_settings, 'jupyter_custom_image', '') or '' if app_settings else '',
            # Note: API keys are NOT exported for security
            'created_at': app_settings.created_at.isoformat() if app_settings else datetime.utcnow().isoformat(),
            'updated_at': app_settings.updated_at.isoformat() if app_settings else datetime.utcnow().isoformat(),
        },
        'llm_conversations': [
            {
                'id': conv.id,
                'entry_id': conv.entry_id,
                'messages': conv.messages,
                'created_at': conv.created_at.isoformat(),
                'updated_at': conv.updated_at.isoformat(),
            }
            for conv in llm_conversations
        ],
        'mcp_servers': [
            {
                'id': server.id,
                'name': server.name,
                'server_type': getattr(server, 'server_type', 'docker') or 'docker',
                'transport_type': getattr(server, 'transport_type', 'http') or 'http',
                'image': server.image or '',
                'port': server.port or 0,
                'build_source': getattr(server, 'build_source', 'image') or 'image',
                'build_context': getattr(server, 'build_context', '') or '',
                'dockerfile_path': getattr(server, 'dockerfile_path', '') or '',
                'url': getattr(server, 'url', '') or '',
                'headers': getattr(server, 'headers', '{}') or '{}',
                'description': server.description or '',
                'color': getattr(server, 'color', '#22c55e') or '#22c55e',
                'env_vars': server.env_vars or '[]',
                'auto_start': bool(server.auto_start),
                'source': server.source or 'local',
                'manifest_url': server.manifest_url or '',
                'created_at': server.created_at.isoformat(),
                'updated_at': server.updated_at.isoformat(),
            }
            for server in mcp_servers
        ],
        'mcp_routing_rules': [
            {
                'id': rule.id,
                'mcp_server_id': rule.mcp_server_id,
                'pattern': rule.pattern,
                'priority': rule.priority,
                'is_enabled': bool(rule.is_enabled),
                'created_at': rule.created_at.isoformat(),
            }
            for rule in mcp_routing_rules
        ],
        'sprint_goals': [
            {
                'id': goal.id,
                'text': goal.text,
                'start_date': goal.start_date,
                'end_date': goal.end_date,
                'created_at': goal.created_at.isoformat(),
                'updated_at': goal.updated_at.isoformat(),
            }
            for goal in sprint_goals
        ],
        'quarterly_goals': [
            {
                'id': goal.id,
                'text': goal.text,
                'start_date': goal.start_date,
                'end_date': goal.end_date,
                'created_at': goal.created_at.isoformat(),
                'updated_at': goal.updated_at.isoformat(),
            }
            for goal in quarterly_goals
        ],
        'goals': [
            {
                'id': goal.id,
                'name': goal.name,
                'goal_type': goal.goal_type,
                'text': goal.text,
                'start_date': goal.start_date,
                'end_date': goal.end_date,
                'end_time': goal.end_time or '',
                'status_text': goal.status_text or '',
                'show_countdown': bool(goal.show_countdown),
                'is_completed': bool(goal.is_completed),
                'completed_at': goal.completed_at.isoformat() if goal.completed_at else None,
                'is_visible': bool(goal.is_visible),
                'order_index': goal.order_index,
                'created_at': goal.created_at.isoformat(),
                'updated_at': goal.updated_at.isoformat(),
            }
            for goal in goals
        ],
        'notes': [
            {
                'date': note.date,
                'fire_rating': note.fire_rating,
                'daily_goal': note.daily_goal,
                'created_at': note.created_at.isoformat(),
                'updated_at': note.updated_at.isoformat(),
                'labels': [label.id for label in note.labels],
                'entries': [
                    {
                        'title': entry.title if hasattr(entry, 'title') else '',
                        'content': entry.content,
                        'content_type': entry.content_type,
                        'order_index': entry.order_index,
                        'include_in_report': bool(entry.include_in_report),
                        'is_important': bool(entry.is_important),
                        'is_completed': bool(entry.is_completed),
                        'is_pinned': bool(entry.is_pinned),
                        'is_archived': bool(entry.is_archived) if hasattr(entry, 'is_archived') else False,
                        'created_at': entry.created_at.isoformat(),
                        'updated_at': entry.updated_at.isoformat(),
                        'labels': [label.id for label in entry.labels],
                        'lists': [lst.id for lst in entry.lists],
                    }
                    for entry in note.entries
                ],
            }
            for note in notes
        ],
    }

    # Create JSON file in memory
    json_data = json.dumps(export_data, indent=2)

    # Return as downloadable file
    return StreamingResponse(
        io.BytesIO(json_data.encode()),
        media_type='application/json',
        headers={
            'Content-Disposition': f"attachment; filename=track-the-thing-backup-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.json"
        },
    )


def html_to_markdown(html_content: str) -> str:
    """Convert HTML content to markdown"""
    if not html_content:
        return ''

    # Unescape HTML entities
    text = unescape(html_content)

    # Convert headers
    text = re.sub(r'<h1[^>]*>(.*?)</h1>', r'# \1\n', text, flags=re.DOTALL)
    text = re.sub(r'<h2[^>]*>(.*?)</h2>', r'## \1\n', text, flags=re.DOTALL)
    text = re.sub(r'<h3[^>]*>(.*?)</h3>', r'### \1\n', text, flags=re.DOTALL)
    text = re.sub(r'<h4[^>]*>(.*?)</h4>', r'#### \1\n', text, flags=re.DOTALL)
    text = re.sub(r'<h5[^>]*>(.*?)</h5>', r'##### \1\n', text, flags=re.DOTALL)
    text = re.sub(r'<h6[^>]*>(.*?)</h6>', r'###### \1\n', text, flags=re.DOTALL)

    # Convert bold
    text = re.sub(r'<strong[^>]*>(.*?)</strong>', r'**\1**', text, flags=re.DOTALL)
    text = re.sub(r'<b[^>]*>(.*?)</b>', r'**\1**', text, flags=re.DOTALL)

    # Convert italic
    text = re.sub(r'<em[^>]*>(.*?)</em>', r'*\1*', text, flags=re.DOTALL)
    text = re.sub(r'<i[^>]*>(.*?)</i>', r'*\1*', text, flags=re.DOTALL)

    # Convert links
    text = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', r'[\2](\1)', text, flags=re.DOTALL)

    # Convert code blocks
    text = re.sub(r'<pre[^>]*><code[^>]*>(.*?)</code></pre>', r'```\n\1\n```', text, flags=re.DOTALL)

    # Convert inline code
    text = re.sub(r'<code[^>]*>(.*?)</code>', r'`\1`', text, flags=re.DOTALL)

    # Convert blockquotes
    text = re.sub(
        r'<blockquote[^>]*>(.*?)</blockquote>',
        lambda m: '\n'.join('> ' + line for line in m.group(1).strip().split('\n')) + '\n',
        text,
        flags=re.DOTALL,
    )

    # Convert lists
    text = re.sub(r'<ul[^>]*>(.*?)</ul>', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'<ol[^>]*>(.*?)</ol>', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'<li[^>]*>(.*?)</li>', r'- \1\n', text, flags=re.DOTALL)

    # Convert line breaks
    text = re.sub(r'<br\s*/?>', '\n', text)

    # Convert paragraphs
    text = re.sub(r'<p[^>]*>(.*?)</p>', r'\1\n\n', text, flags=re.DOTALL)

    # Remove remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)

    # Clean up multiple newlines
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


@router.get('/export-markdown')
async def export_markdown(db: Session = Depends(get_db)):
    """Export all data as Markdown for LLM consumption"""

    # Get all notes with entries and labels, sorted by date
    notes = db.query(models.DailyNote).order_by(models.DailyNote.date).all()
    labels = db.query(models.Label).all()

    # Build markdown content
    markdown_lines = []
    markdown_lines.append('# Track the Thing Export')
    markdown_lines.append(f"\nExported: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n")
    markdown_lines.append('---\n')

    # Add label index
    if labels:
        markdown_lines.append('## Labels\n')
        for label in labels:
            markdown_lines.append(f'- **{label.name}**')
        markdown_lines.append('\n---\n')

    # Add persistent goals at the top
    # First, add goals from unified goal table (v9.0+)
    unified_goals = db.query(models.Goal).order_by(models.Goal.order_index).all()
    if unified_goals:
        markdown_lines.append('\n## Goals\n')
        for goal in unified_goals:
            status = '✅ ' if goal.is_completed else ''
            markdown_lines.append(f'### {status}{goal.name} ({goal.goal_type})\n')
            markdown_lines.append(f'**Date Range:** {goal.start_date} to {goal.end_date}\n')
            if goal.status_text:
                markdown_lines.append(f'**Status:** {goal.status_text}\n')
            if goal.text:
                markdown_lines.append(f'{goal.text}\n')
            markdown_lines.append('\n')
        markdown_lines.append('---\n')

    # Legacy: Add goals from sprint_goals/quarterly_goals tables
    sprint_goals = db.query(models.SprintGoal).order_by(models.SprintGoal.start_date).all()
    if sprint_goals:
        markdown_lines.append('\n## Sprint Goals (Legacy)\n')
        for goal in sprint_goals:
            markdown_lines.append(f'### {goal.start_date} to {goal.end_date}\n')
            markdown_lines.append(f'{goal.text}\n')
        markdown_lines.append('\n---\n')

    quarterly_goals = db.query(models.QuarterlyGoal).order_by(models.QuarterlyGoal.start_date).all()
    if quarterly_goals:
        markdown_lines.append('\n## Quarterly Goals (Legacy)\n')
        for goal in quarterly_goals:
            markdown_lines.append(f'### {goal.start_date} to {goal.end_date}\n')
            markdown_lines.append(f'{goal.text}\n')
        markdown_lines.append('\n---\n')

    # Legacy: Add goals from app_settings if they exist (for backwards compatibility)
    app_settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()
    if app_settings:
        if app_settings.sprint_goals:
            date_range = ''
            if app_settings.sprint_start_date or app_settings.sprint_end_date:
                date_range = f' ({app_settings.sprint_start_date} to {app_settings.sprint_end_date})'
            markdown_lines.append(f'\n## Sprint Goals (Legacy){date_range}\n{app_settings.sprint_goals}\n\n---\n')
        if app_settings.quarterly_goals:
            date_range = ''
            if app_settings.quarterly_start_date or app_settings.quarterly_end_date:
                date_range = f' ({app_settings.quarterly_start_date} to {app_settings.quarterly_end_date})'
            markdown_lines.append(f'\n## Quarterly Goals (Legacy){date_range}\n{app_settings.quarterly_goals}\n\n---\n')

    # Add notes
    for note in notes:
        if not note.entries and not note.daily_goal:
            continue

        markdown_lines.append(f'\n## {note.date}\n')

        # Add daily goal if present
        if note.daily_goal:
            markdown_lines.append(f'**Daily Goals:** {note.daily_goal}\n')

        # Add note labels if present
        if note.labels:
            label_names = [label.name for label in note.labels]
            markdown_lines.append(f"**Day Labels:** {', '.join(label_names)}\n")

        # Add entries
        if note.entries:
            for idx, entry in enumerate(note.entries, 1):
                # Use title if available, otherwise use generic "Entry X"
                entry_title = entry.title if hasattr(entry, 'title') and entry.title else f'Entry {idx}'
                markdown_lines.append(f'\n### {entry_title}')
                markdown_lines.append(f"*Created: {entry.created_at.strftime('%Y-%m-%d %H:%M:%S')}*\n")

                # Add entry metadata
                metadata = []
                if entry.is_important:
                    metadata.append('⭐ Important')
                if entry.is_completed:
                    metadata.append('✓ Completed')
                if entry.is_pinned:
                    metadata.append('📌 Pinned')
                if entry.include_in_report:
                    metadata.append('📄 In Report')

                if metadata:
                    markdown_lines.append(f"**Status:** {' | '.join(metadata)}\n")

                # Add entry labels
                if entry.labels:
                    label_names = [label.name for label in entry.labels]
                    markdown_lines.append(f"**Labels:** {', '.join(label_names)}\n")

                # Add content
                if entry.content_type == 'code':
                    markdown_lines.append(f'\n```\n{entry.content}\n```\n')
                else:
                    # Convert HTML to markdown
                    content_md = html_to_markdown(entry.content)
                    markdown_lines.append(f'\n{content_md}\n')

        markdown_lines.append('\n---\n')

    # Join all lines
    markdown_content = '\n'.join(markdown_lines)

    # Return as downloadable file
    return StreamingResponse(
        io.BytesIO(markdown_content.encode('utf-8')),
        media_type='text/markdown',
        headers={
            'Content-Disposition': f"attachment; filename=track-the-thing-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.md"
        },
    )


@router.post('/import')
async def import_data(file: UploadFile = File(...), replace: bool = False, db: Session = Depends(get_db)):
    """Import data from JSON backup file"""

    try:
        content = await file.read()
        data = json.loads(content)

        # Validate data structure
        if 'version' not in data or 'notes' not in data:
            raise HTTPException(status_code=400, detail='Invalid backup file format')

        stats = {
            'labels_imported': 0,
            'lists_imported': 0,
            'custom_emojis_imported': 0,
            'custom_emojis_skipped': 0,
            'reminders_imported': 0,
            'reminders_skipped': 0,
            'notes_imported': 0,
            'entries_imported': 0,
            'labels_skipped': 0,
            'lists_skipped': 0,
            'notes_skipped': 0,
            'search_history_imported': 0,
            'sprint_goals_imported': 0,
            'quarterly_goals_imported': 0,
            'goals_imported': 0,
            'goals_skipped': 0,
            'mcp_servers_imported': 0,
            'mcp_servers_skipped': 0,
            'mcp_routing_rules_imported': 0,
            'mcp_routing_rules_skipped': 0,
        }

        legacy_lists = 'lists' not in data

        with db.begin():
            # Import search history
            search_history_data = data.get('search_history', [])
            for history_item in search_history_data:
                existing = (
                    db.query(models.SearchHistory)
                    .filter(
                        models.SearchHistory.query == history_item['query'],
                        models.SearchHistory.created_at == datetime.fromisoformat(history_item['created_at']),
                    )
                    .first()
                )

                if not existing:
                    new_history = models.SearchHistory(
                        query=history_item['query'], created_at=datetime.fromisoformat(history_item['created_at'])
                    )
                    db.add(new_history)
                    stats['search_history_imported'] += 1

            # Import custom emojis if present
            if 'custom_emojis' in data:
                for emoji_data in data['custom_emojis']:
                    existing_emoji = (
                        db.query(models.CustomEmoji).filter(models.CustomEmoji.name == emoji_data['name']).first()
                    )

                    if not existing_emoji:
                        new_emoji = models.CustomEmoji(
                            name=emoji_data['name'],
                            image_url=emoji_data['image_url'],
                            category=emoji_data.get('category', 'Custom'),
                            keywords=emoji_data.get('keywords', ''),
                            is_deleted=1 if emoji_data.get('is_deleted', False) else 0,
                            created_at=datetime.fromisoformat(emoji_data['created_at'])
                            if 'created_at' in emoji_data
                            else datetime.utcnow(),
                            updated_at=datetime.fromisoformat(emoji_data['updated_at'])
                            if 'updated_at' in emoji_data
                            else datetime.utcnow(),
                        )
                        db.add(new_emoji)
                        stats['custom_emojis_imported'] += 1
                    else:
                        stats['custom_emojis_skipped'] += 1

            # Import reminders if present
            # Note: Reminders are imported after all entries are created,
            # so entry_id references will be valid
            if 'reminders' in data:
                # First, we need to create a mapping from old entry IDs to new entry IDs
                # This is important because entry IDs might change during import
                # For now, we'll skip reminders that reference non-existent entries
                for reminder_data in data['reminders']:
                    # Check if the entry exists
                    entry_exists = (
                        db.query(models.NoteEntry).filter(models.NoteEntry.id == reminder_data['entry_id']).first()
                    )

                    if entry_exists:
                        # Check if reminder already exists for this entry
                        existing_reminder = (
                            db.query(models.Reminder)
                            .filter(models.Reminder.entry_id == reminder_data['entry_id'])
                            .first()
                        )

                        if not existing_reminder:
                            new_reminder = models.Reminder(
                                entry_id=reminder_data['entry_id'],
                                reminder_datetime=reminder_data['reminder_datetime'],
                                is_dismissed=1 if reminder_data.get('is_dismissed', False) else 0,
                                created_at=datetime.fromisoformat(reminder_data['created_at'])
                                if 'created_at' in reminder_data
                                else datetime.utcnow(),
                                updated_at=datetime.fromisoformat(reminder_data['updated_at'])
                                if 'updated_at' in reminder_data
                                else datetime.utcnow(),
                            )
                            db.add(new_reminder)
                            stats['reminders_imported'] += 1
                        else:
                            stats['reminders_skipped'] += 1
                    else:
                        stats['reminders_skipped'] += 1

            # Import app_settings if present
            if 'app_settings' in data and data['app_settings']:
                settings_data = data['app_settings']
                existing_settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()
                if existing_settings:
                    existing_settings.sprint_goals = settings_data.get('sprint_goals', '')
                    existing_settings.quarterly_goals = settings_data.get('quarterly_goals', '')
                    existing_settings.sprint_start_date = settings_data.get('sprint_start_date', '')
                    existing_settings.sprint_end_date = settings_data.get('sprint_end_date', '')
                    existing_settings.quarterly_start_date = settings_data.get('quarterly_start_date', '')
                    existing_settings.quarterly_end_date = settings_data.get('quarterly_end_date', '')
                    existing_settings.emoji_library = settings_data.get('emoji_library', 'emoji-picker-react')
                    existing_settings.sprint_name = settings_data.get('sprint_name', 'Sprint')
                    existing_settings.daily_goal_end_time = settings_data.get('daily_goal_end_time', '17:00')
                    existing_settings.texture_enabled = 1 if settings_data.get('texture_enabled', False) else 0
                    existing_settings.texture_settings = settings_data.get('texture_settings', '{}')
                    existing_settings.llm_provider = settings_data.get('llm_provider', 'openai')
                    existing_settings.openai_api_type = settings_data.get('openai_api_type', 'chat_completions')
                    existing_settings.llm_global_prompt = settings_data.get('llm_global_prompt', '')
                    existing_settings.mcp_enabled = 1 if settings_data.get('mcp_enabled', False) else 0
                    existing_settings.mcp_idle_timeout = settings_data.get('mcp_idle_timeout', 300)
                    existing_settings.mcp_fallback_to_llm = 1 if settings_data.get('mcp_fallback_to_llm', True) else 0
                    existing_settings.jupyter_enabled = 1 if settings_data.get('jupyter_enabled', False) else 0
                    existing_settings.jupyter_auto_start = 1 if settings_data.get('jupyter_auto_start', False) else 0
                    existing_settings.jupyter_python_version = (
                        settings_data.get('jupyter_python_version', '3.11') or '3.11'
                    )
                    existing_settings.jupyter_custom_image = settings_data.get('jupyter_custom_image', '') or ''
                else:
                    new_settings = models.AppSettings(
                        id=1,
                        sprint_goals=settings_data.get('sprint_goals', ''),
                        quarterly_goals=settings_data.get('quarterly_goals', ''),
                        sprint_start_date=settings_data.get('sprint_start_date', ''),
                        sprint_end_date=settings_data.get('sprint_end_date', ''),
                        quarterly_start_date=settings_data.get('quarterly_start_date', ''),
                        quarterly_end_date=settings_data.get('quarterly_end_date', ''),
                        emoji_library=settings_data.get('emoji_library', 'emoji-picker-react'),
                        sprint_name=settings_data.get('sprint_name', 'Sprint'),
                        daily_goal_end_time=settings_data.get('daily_goal_end_time', '17:00'),
                        texture_enabled=1 if settings_data.get('texture_enabled', False) else 0,
                        texture_settings=settings_data.get('texture_settings', '{}'),
                        llm_provider=settings_data.get('llm_provider', 'openai'),
                        openai_api_type=settings_data.get('openai_api_type', 'chat_completions'),
                        llm_global_prompt=settings_data.get('llm_global_prompt', ''),
                        mcp_enabled=1 if settings_data.get('mcp_enabled', False) else 0,
                        mcp_idle_timeout=settings_data.get('mcp_idle_timeout', 300),
                        mcp_fallback_to_llm=1 if settings_data.get('mcp_fallback_to_llm', True) else 0,
                        jupyter_enabled=1 if settings_data.get('jupyter_enabled', False) else 0,
                        jupyter_auto_start=1 if settings_data.get('jupyter_auto_start', False) else 0,
                        jupyter_python_version=settings_data.get('jupyter_python_version', '3.11') or '3.11',
                        jupyter_custom_image=settings_data.get('jupyter_custom_image', '') or '',
                        created_at=datetime.fromisoformat(settings_data['created_at'])
                        if 'created_at' in settings_data
                        else datetime.utcnow(),
                        updated_at=datetime.fromisoformat(settings_data['updated_at'])
                        if 'updated_at' in settings_data
                        else datetime.utcnow(),
                    )
                    db.add(new_settings)

            # Import sprint goals if present
            if 'sprint_goals' in data:
                for goal_data in data['sprint_goals']:
                    existing_goal = (
                        db.query(models.SprintGoal)
                        .filter(
                            models.SprintGoal.start_date == goal_data['start_date'],
                            models.SprintGoal.end_date == goal_data['end_date'],
                        )
                        .first()
                    )

                    if not existing_goal:
                        new_goal = models.SprintGoal(
                            text=goal_data['text'],
                            start_date=goal_data['start_date'],
                            end_date=goal_data['end_date'],
                            created_at=datetime.fromisoformat(goal_data['created_at'])
                            if 'created_at' in goal_data
                            else datetime.utcnow(),
                            updated_at=datetime.fromisoformat(goal_data['updated_at'])
                            if 'updated_at' in goal_data
                            else datetime.utcnow(),
                        )
                        db.add(new_goal)
                        stats['sprint_goals_imported'] += 1

            # Import quarterly goals if present
            if 'quarterly_goals' in data:
                for goal_data in data['quarterly_goals']:
                    existing_goal = (
                        db.query(models.QuarterlyGoal)
                        .filter(
                            models.QuarterlyGoal.start_date == goal_data['start_date'],
                            models.QuarterlyGoal.end_date == goal_data['end_date'],
                        )
                        .first()
                    )

                    if not existing_goal:
                        new_goal = models.QuarterlyGoal(
                            text=goal_data['text'],
                            start_date=goal_data['start_date'],
                            end_date=goal_data['end_date'],
                            created_at=datetime.fromisoformat(goal_data['created_at'])
                            if 'created_at' in goal_data
                            else datetime.utcnow(),
                            updated_at=datetime.fromisoformat(goal_data['updated_at'])
                            if 'updated_at' in goal_data
                            else datetime.utcnow(),
                        )
                        db.add(new_goal)
                        stats['quarterly_goals_imported'] += 1

            # Import unified goals if present (v9.0+)
            if 'goals' in data:
                for goal_data in data['goals']:
                    # Check for existing goal with same name, type, and date range
                    existing_goal = (
                        db.query(models.Goal)
                        .filter(
                            models.Goal.name == goal_data['name'],
                            models.Goal.goal_type == goal_data['goal_type'],
                            models.Goal.start_date == goal_data['start_date'],
                            models.Goal.end_date == goal_data['end_date'],
                        )
                        .first()
                    )

                    if not existing_goal:
                        new_goal = models.Goal(
                            name=goal_data['name'],
                            goal_type=goal_data['goal_type'],
                            text=goal_data.get('text', ''),
                            start_date=goal_data['start_date'],
                            end_date=goal_data['end_date'],
                            end_time=goal_data.get('end_time', ''),
                            status_text=goal_data.get('status_text', ''),
                            show_countdown=1 if goal_data.get('show_countdown', True) else 0,
                            is_completed=1 if goal_data.get('is_completed', False) else 0,
                            completed_at=datetime.fromisoformat(goal_data['completed_at'])
                            if goal_data.get('completed_at')
                            else None,
                            is_visible=1 if goal_data.get('is_visible', True) else 0,
                            order_index=goal_data.get('order_index', 0),
                            created_at=datetime.fromisoformat(goal_data['created_at'])
                            if 'created_at' in goal_data
                            else datetime.utcnow(),
                            updated_at=datetime.fromisoformat(goal_data['updated_at'])
                            if 'updated_at' in goal_data
                            else datetime.utcnow(),
                        )
                        db.add(new_goal)
                        stats['goals_imported'] += 1
                    else:
                        stats['goals_skipped'] += 1

            # Import LLM conversations if present
            if 'llm_conversations' in data:
                for conv_data in data['llm_conversations']:
                    # Check if entry exists
                    entry_exists = (
                        db.query(models.NoteEntry).filter(models.NoteEntry.id == conv_data['entry_id']).first()
                    )

                    if entry_exists:
                        existing_conv = (
                            db.query(models.LlmConversation)
                            .filter(models.LlmConversation.entry_id == conv_data['entry_id'])
                            .first()
                        )

                        if not existing_conv:
                            new_conv = models.LlmConversation(
                                entry_id=conv_data['entry_id'],
                                messages=conv_data['messages'],
                                created_at=datetime.fromisoformat(conv_data['created_at'])
                                if 'created_at' in conv_data
                                else datetime.utcnow(),
                                updated_at=datetime.fromisoformat(conv_data['updated_at'])
                                if 'updated_at' in conv_data
                                else datetime.utcnow(),
                            )
                            db.add(new_conv)

            # Import MCP servers if present (v10.0+)
            mcp_server_id_mapping = {}
            if 'mcp_servers' in data:
                for server_data in data['mcp_servers']:
                    existing_server = (
                        db.query(models.McpServer).filter(models.McpServer.name == server_data['name']).first()
                    )

                    if not existing_server:
                        new_server = models.McpServer(
                            name=server_data['name'],
                            server_type=server_data.get('server_type', 'docker'),
                            transport_type=server_data.get('transport_type', 'http'),
                            image=server_data.get('image', ''),
                            port=server_data.get('port', 0),
                            build_source=server_data.get('build_source', 'image'),
                            build_context=server_data.get('build_context', ''),
                            dockerfile_path=server_data.get('dockerfile_path', ''),
                            url=server_data.get('url', ''),
                            headers=server_data.get('headers', '{}'),
                            description=server_data.get('description', ''),
                            color=server_data.get('color', '#22c55e'),
                            env_vars=server_data.get('env_vars', '[]'),
                            auto_start=1 if server_data.get('auto_start', False) else 0,
                            source=server_data.get('source', 'local'),
                            manifest_url=server_data.get('manifest_url', ''),
                            status='stopped',  # Always import as stopped
                            created_at=datetime.fromisoformat(server_data['created_at'])
                            if 'created_at' in server_data
                            else datetime.utcnow(),
                            updated_at=datetime.fromisoformat(server_data['updated_at'])
                            if 'updated_at' in server_data
                            else datetime.utcnow(),
                        )
                        db.add(new_server)
                        db.flush()
                        mcp_server_id_mapping[server_data['id']] = new_server.id
                        stats['mcp_servers_imported'] += 1
                    else:
                        mcp_server_id_mapping[server_data['id']] = existing_server.id
                        stats['mcp_servers_skipped'] += 1

            # Import MCP routing rules if present (v10.0+)
            if 'mcp_routing_rules' in data:
                for rule_data in data['mcp_routing_rules']:
                    old_server_id = rule_data['mcp_server_id']
                    if old_server_id in mcp_server_id_mapping:
                        new_server_id = mcp_server_id_mapping[old_server_id]

                        # Check if rule already exists
                        existing_rule = (
                            db.query(models.McpRoutingRule)
                            .filter(
                                models.McpRoutingRule.mcp_server_id == new_server_id,
                                models.McpRoutingRule.pattern == rule_data['pattern'],
                            )
                            .first()
                        )

                        if not existing_rule:
                            new_rule = models.McpRoutingRule(
                                mcp_server_id=new_server_id,
                                pattern=rule_data['pattern'],
                                priority=rule_data.get('priority', 0),
                                is_enabled=1 if rule_data.get('is_enabled', True) else 0,
                                created_at=datetime.fromisoformat(rule_data['created_at'])
                                if 'created_at' in rule_data
                                else datetime.utcnow(),
                            )
                            db.add(new_rule)
                            stats['mcp_routing_rules_imported'] += 1
                        else:
                            stats['mcp_routing_rules_skipped'] += 1

            # Import labels (support both old "tags" and new "labels" format)
            label_id_mapping = {}
            labels_data = data.get('labels', data.get('tags', []))
            for label_data in labels_data:
                existing_label = db.query(models.Label).filter(models.Label.name == label_data['name']).first()
                if existing_label:
                    label_id_mapping[label_data['id']] = existing_label.id
                    stats['labels_skipped'] += 1
                else:
                    new_label = models.Label(
                        name=label_data['name'],
                        color=label_data.get('color', '#3b82f6'),
                        created_at=datetime.fromisoformat(label_data['created_at'])
                        if 'created_at' in label_data
                        else datetime.utcnow(),
                    )
                    db.add(new_label)
                    db.flush()
                    label_id_mapping[label_data['id']] = new_label.id
                    stats['labels_imported'] += 1

            # Import lists
            list_id_mapping = {}
            lists_data = data.get('lists', [])
            for list_data in lists_data:
                existing_list = db.query(models.List).filter(models.List.name == list_data['name']).first()
                if existing_list:
                    list_id_mapping[list_data['id']] = existing_list.id
                    stats['lists_skipped'] += 1
                else:
                    new_list = models.List(
                        name=list_data['name'],
                        description=list_data.get('description', ''),
                        color=list_data.get('color', '#3b82f6'),
                        order_index=list_data.get('order_index', 0),
                        is_archived=1 if list_data.get('is_archived', False) else 0,
                        is_kanban=1 if list_data.get('is_kanban', False) else 0,
                        kanban_order=list_data.get('kanban_order', 0),
                        created_at=datetime.fromisoformat(list_data['created_at'])
                        if 'created_at' in list_data
                        else datetime.utcnow(),
                        updated_at=datetime.fromisoformat(list_data['updated_at'])
                        if 'updated_at' in list_data
                        else datetime.utcnow(),
                    )
                    db.add(new_list)
                    db.flush()
                    list_id_mapping[list_data['id']] = new_list.id
                    stats['lists_imported'] += 1

            # Import notes
            for note_data in data['notes']:
                existing_note = db.query(models.DailyNote).filter(models.DailyNote.date == note_data['date']).first()

                if existing_note:
                    if replace:
                        db.query(models.NoteEntry).filter(models.NoteEntry.daily_note_id == existing_note.id).delete()
                        existing_note.labels.clear()
                        note = existing_note
                        note.fire_rating = note_data.get('fire_rating', 0)
                        note.daily_goal = note_data.get('daily_goal', '')
                        if 'created_at' in note_data:
                            note.created_at = datetime.fromisoformat(note_data['created_at'])
                        if 'updated_at' in note_data:
                            note.updated_at = datetime.fromisoformat(note_data['updated_at'])
                    else:
                        stats['notes_skipped'] += 1
                        continue
                else:
                    note = models.DailyNote(
                        date=note_data['date'],
                        fire_rating=note_data.get('fire_rating', 0),
                        daily_goal=note_data.get('daily_goal', ''),
                        created_at=datetime.fromisoformat(note_data['created_at'])
                        if 'created_at' in note_data
                        else datetime.utcnow(),
                        updated_at=datetime.fromisoformat(note_data['updated_at'])
                        if 'updated_at' in note_data
                        else datetime.utcnow(),
                    )
                    db.add(note)
                    stats['notes_imported'] += 1

                db.flush()

                # Add entries
                for entry_data in note_data.get('entries', []):
                    entry = models.NoteEntry(
                        daily_note_id=note.id,
                        title=entry_data.get('title', ''),
                        content=entry_data['content'],
                        content_type=entry_data.get('content_type', 'rich_text'),
                        order_index=entry_data.get('order_index', 0),
                        include_in_report=1 if entry_data.get('include_in_report', False) else 0,
                        is_important=1 if entry_data.get('is_important', False) else 0,
                        is_completed=1 if entry_data.get('is_completed', False) else 0,
                        is_pinned=1 if entry_data.get('is_pinned', False) else 0,
                        is_archived=1 if entry_data.get('is_archived', False) else 0,
                        created_at=datetime.fromisoformat(entry_data['created_at'])
                        if 'created_at' in entry_data
                        else datetime.utcnow(),
                        updated_at=datetime.fromisoformat(entry_data['updated_at'])
                        if 'updated_at' in entry_data
                        else datetime.utcnow(),
                    )
                    db.add(entry)
                    db.flush()

                    # Add entry labels
                    for old_label_id in entry_data.get('labels', []):
                        if old_label_id in label_id_mapping:
                            label = (
                                db.query(models.Label).filter(models.Label.id == label_id_mapping[old_label_id]).first()
                            )
                            if label and label not in entry.labels:
                                entry.labels.append(label)

                    # Add entry to lists
                    for old_list_id in entry_data.get('lists', []):
                        if old_list_id in list_id_mapping:
                            lst = db.query(models.List).filter(models.List.id == list_id_mapping[old_list_id]).first()
                            if lst and lst not in entry.lists:
                                entry.lists.append(lst)

                    stats['entries_imported'] += 1

                # Add note labels (support both old "tags" and new "labels" format)
                note_labels = note_data.get('labels', note_data.get('tags', []))
                for old_label_id in note_labels:
                    if old_label_id in label_id_mapping:
                        label = db.query(models.Label).filter(models.Label.id == label_id_mapping[old_label_id]).first()
                        if label and label not in note.labels:
                            note.labels.append(label)

        response = {'success': True, 'message': 'Data imported successfully', 'stats': stats}
        if legacy_lists:
            response['warning'] = (
                'Backup file is missing list/kanban data (pre-v7 export). ' 'Lists will need to be recreated manually.'
            )

        return response

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail='Invalid JSON file')
    except HTTPException as e:
        # Preserve intended HTTP status/details
        db.rollback()
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f'Import failed: {str(e)}')


@router.post('/full-restore')
async def full_restore(
    backup_file: UploadFile = File(...),
    files_archive: UploadFile = File(...),
    replace: bool = False,
    db: Session = Depends(get_db),
):
    """
    Full restore: Import both JSON backup and files archive in one operation.
    This ensures a complete machine-to-machine migration.
    """
    import zipfile

    # Validate file types
    if not backup_file.filename or not backup_file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail='Backup file must be a JSON file')

    if not files_archive.filename or not files_archive.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail='Files archive must be a ZIP file')

    stats = {'data_restore': {}, 'files_restore': {}, 'success': False, 'message': ''}

    try:
        # Step 1: Restore data from JSON
        content = await backup_file.read()
        data = json.loads(content)

        # Validate data structure
        if 'version' not in data or 'notes' not in data:
            raise HTTPException(status_code=400, detail='Invalid backup file format')

        data_stats = {
            'labels_imported': 0,
            'notes_imported': 0,
            'entries_imported': 0,
            'labels_skipped': 0,
            'notes_skipped': 0,
            'search_history_imported': 0,
            'sprint_goals_imported': 0,
            'quarterly_goals_imported': 0,
            'goals_imported': 0,
            'goals_skipped': 0,
        }

        # Import search history
        search_history_data = data.get('search_history', [])
        for history_item in search_history_data:
            existing = (
                db.query(models.SearchHistory)
                .filter(
                    models.SearchHistory.query == history_item['query'],
                    models.SearchHistory.created_at == datetime.fromisoformat(history_item['created_at']),
                )
                .first()
            )

            if not existing:
                new_history = models.SearchHistory(
                    query=history_item['query'], created_at=datetime.fromisoformat(history_item['created_at'])
                )
                db.add(new_history)
                data_stats['search_history_imported'] += 1

        db.commit()

        # Import app_settings if present
        if 'app_settings' in data and data['app_settings']:
            settings_data = data['app_settings']
            existing_settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()
            if existing_settings:
                existing_settings.sprint_goals = settings_data.get('sprint_goals', '')
                existing_settings.quarterly_goals = settings_data.get('quarterly_goals', '')
                existing_settings.sprint_start_date = settings_data.get('sprint_start_date', '')
                existing_settings.sprint_end_date = settings_data.get('sprint_end_date', '')
                existing_settings.quarterly_start_date = settings_data.get('quarterly_start_date', '')
                existing_settings.quarterly_end_date = settings_data.get('quarterly_end_date', '')
                existing_settings.emoji_library = settings_data.get('emoji_library', 'emoji-picker-react')
                existing_settings.sprint_name = settings_data.get('sprint_name', 'Sprint')
                existing_settings.daily_goal_end_time = settings_data.get('daily_goal_end_time', '17:00')
                existing_settings.texture_enabled = 1 if settings_data.get('texture_enabled', False) else 0
                existing_settings.texture_settings = settings_data.get('texture_settings', '{}')
                existing_settings.llm_provider = settings_data.get('llm_provider', 'openai')
                existing_settings.openai_api_type = settings_data.get('openai_api_type', 'chat_completions')
                existing_settings.llm_global_prompt = settings_data.get('llm_global_prompt', '')
                existing_settings.mcp_enabled = 1 if settings_data.get('mcp_enabled', False) else 0
                existing_settings.mcp_idle_timeout = settings_data.get('mcp_idle_timeout', 300)
                existing_settings.mcp_fallback_to_llm = 1 if settings_data.get('mcp_fallback_to_llm', True) else 0
                existing_settings.jupyter_enabled = 1 if settings_data.get('jupyter_enabled', False) else 0
                existing_settings.jupyter_auto_start = 1 if settings_data.get('jupyter_auto_start', False) else 0
                existing_settings.jupyter_python_version = settings_data.get('jupyter_python_version', '3.11') or '3.11'
                existing_settings.jupyter_custom_image = settings_data.get('jupyter_custom_image', '') or ''
            else:
                new_settings = models.AppSettings(
                    id=1,
                    sprint_goals=settings_data.get('sprint_goals', ''),
                    quarterly_goals=settings_data.get('quarterly_goals', ''),
                    sprint_start_date=settings_data.get('sprint_start_date', ''),
                    sprint_end_date=settings_data.get('sprint_end_date', ''),
                    quarterly_start_date=settings_data.get('quarterly_start_date', ''),
                    quarterly_end_date=settings_data.get('quarterly_end_date', ''),
                    emoji_library=settings_data.get('emoji_library', 'emoji-picker-react'),
                    sprint_name=settings_data.get('sprint_name', 'Sprint'),
                    daily_goal_end_time=settings_data.get('daily_goal_end_time', '17:00'),
                    texture_enabled=1 if settings_data.get('texture_enabled', False) else 0,
                    texture_settings=settings_data.get('texture_settings', '{}'),
                    llm_provider=settings_data.get('llm_provider', 'openai'),
                    openai_api_type=settings_data.get('openai_api_type', 'chat_completions'),
                    llm_global_prompt=settings_data.get('llm_global_prompt', ''),
                    mcp_enabled=1 if settings_data.get('mcp_enabled', False) else 0,
                    mcp_idle_timeout=settings_data.get('mcp_idle_timeout', 300),
                    mcp_fallback_to_llm=1 if settings_data.get('mcp_fallback_to_llm', True) else 0,
                    jupyter_enabled=1 if settings_data.get('jupyter_enabled', False) else 0,
                    jupyter_auto_start=1 if settings_data.get('jupyter_auto_start', False) else 0,
                    jupyter_python_version=settings_data.get('jupyter_python_version', '3.11') or '3.11',
                    jupyter_custom_image=settings_data.get('jupyter_custom_image', '') or '',
                    created_at=datetime.fromisoformat(settings_data['created_at'])
                    if 'created_at' in settings_data
                    else datetime.utcnow(),
                    updated_at=datetime.fromisoformat(settings_data['updated_at'])
                    if 'updated_at' in settings_data
                    else datetime.utcnow(),
                )
                db.add(new_settings)
            db.commit()

        # Import sprint goals if present
        if 'sprint_goals' in data:
            for goal_data in data['sprint_goals']:
                existing_goal = (
                    db.query(models.SprintGoal)
                    .filter(
                        models.SprintGoal.start_date == goal_data['start_date'],
                        models.SprintGoal.end_date == goal_data['end_date'],
                    )
                    .first()
                )

                if not existing_goal:
                    new_goal = models.SprintGoal(
                        text=goal_data['text'],
                        start_date=goal_data['start_date'],
                        end_date=goal_data['end_date'],
                        created_at=datetime.fromisoformat(goal_data['created_at'])
                        if 'created_at' in goal_data
                        else datetime.utcnow(),
                        updated_at=datetime.fromisoformat(goal_data['updated_at'])
                        if 'updated_at' in goal_data
                        else datetime.utcnow(),
                    )
                    db.add(new_goal)
                    data_stats['sprint_goals_imported'] += 1
            db.commit()

        # Import quarterly goals if present
        if 'quarterly_goals' in data:
            for goal_data in data['quarterly_goals']:
                existing_goal = (
                    db.query(models.QuarterlyGoal)
                    .filter(
                        models.QuarterlyGoal.start_date == goal_data['start_date'],
                        models.QuarterlyGoal.end_date == goal_data['end_date'],
                    )
                    .first()
                )

                if not existing_goal:
                    new_goal = models.QuarterlyGoal(
                        text=goal_data['text'],
                        start_date=goal_data['start_date'],
                        end_date=goal_data['end_date'],
                        created_at=datetime.fromisoformat(goal_data['created_at'])
                        if 'created_at' in goal_data
                        else datetime.utcnow(),
                        updated_at=datetime.fromisoformat(goal_data['updated_at'])
                        if 'updated_at' in goal_data
                        else datetime.utcnow(),
                    )
                    db.add(new_goal)
                    data_stats['quarterly_goals_imported'] += 1
            db.commit()

        # Import unified goals if present (v9.0+)
        if 'goals' in data:
            for goal_data in data['goals']:
                existing_goal = (
                    db.query(models.Goal)
                    .filter(
                        models.Goal.name == goal_data['name'],
                        models.Goal.goal_type == goal_data['goal_type'],
                        models.Goal.start_date == goal_data['start_date'],
                        models.Goal.end_date == goal_data['end_date'],
                    )
                    .first()
                )

                if not existing_goal:
                    new_goal = models.Goal(
                        name=goal_data['name'],
                        goal_type=goal_data['goal_type'],
                        text=goal_data.get('text', ''),
                        start_date=goal_data['start_date'],
                        end_date=goal_data['end_date'],
                        end_time=goal_data.get('end_time', ''),
                        status_text=goal_data.get('status_text', ''),
                        show_countdown=1 if goal_data.get('show_countdown', True) else 0,
                        is_completed=1 if goal_data.get('is_completed', False) else 0,
                        completed_at=datetime.fromisoformat(goal_data['completed_at'])
                        if goal_data.get('completed_at')
                        else None,
                        is_visible=1 if goal_data.get('is_visible', True) else 0,
                        order_index=goal_data.get('order_index', 0),
                        created_at=datetime.fromisoformat(goal_data['created_at'])
                        if 'created_at' in goal_data
                        else datetime.utcnow(),
                        updated_at=datetime.fromisoformat(goal_data['updated_at'])
                        if 'updated_at' in goal_data
                        else datetime.utcnow(),
                    )
                    db.add(new_goal)
                    data_stats['goals_imported'] += 1
                else:
                    data_stats['goals_skipped'] += 1
            db.commit()

        # Import labels
        label_id_mapping = {}
        labels_data = data.get('labels', data.get('tags', []))
        for label_data in labels_data:
            existing_label = db.query(models.Label).filter(models.Label.name == label_data['name']).first()
            if existing_label:
                label_id_mapping[label_data['id']] = existing_label.id
                data_stats['labels_skipped'] += 1
            else:
                new_label = models.Label(
                    name=label_data['name'],
                    color=label_data.get('color', '#3b82f6'),
                    created_at=datetime.fromisoformat(label_data['created_at'])
                    if 'created_at' in label_data
                    else datetime.utcnow(),
                )
                db.add(new_label)
                db.flush()
                label_id_mapping[label_data['id']] = new_label.id
                data_stats['labels_imported'] += 1

        db.commit()

        # Import notes
        for note_data in data['notes']:
            existing_note = db.query(models.DailyNote).filter(models.DailyNote.date == note_data['date']).first()

            if existing_note:
                if replace:
                    db.query(models.NoteEntry).filter(models.NoteEntry.daily_note_id == existing_note.id).delete()
                    existing_note.labels.clear()
                    note = existing_note
                    note.fire_rating = note_data.get('fire_rating', 0)
                    note.daily_goal = note_data.get('daily_goal', '')
                    if 'created_at' in note_data:
                        note.created_at = datetime.fromisoformat(note_data['created_at'])
                    if 'updated_at' in note_data:
                        note.updated_at = datetime.fromisoformat(note_data['updated_at'])
                else:
                    data_stats['notes_skipped'] += 1
                    continue
            else:
                note = models.DailyNote(
                    date=note_data['date'],
                    fire_rating=note_data.get('fire_rating', 0),
                    daily_goal=note_data.get('daily_goal', ''),
                    created_at=datetime.fromisoformat(note_data['created_at'])
                    if 'created_at' in note_data
                    else datetime.utcnow(),
                    updated_at=datetime.fromisoformat(note_data['updated_at'])
                    if 'updated_at' in note_data
                    else datetime.utcnow(),
                )
                db.add(note)
                data_stats['notes_imported'] += 1

            db.flush()

            # Add entries
            for entry_data in note_data.get('entries', []):
                entry = models.NoteEntry(
                    daily_note_id=note.id,
                    title=entry_data.get('title', ''),
                    content=entry_data['content'],
                    content_type=entry_data.get('content_type', 'rich_text'),
                    order_index=entry_data.get('order_index', 0),
                    include_in_report=1 if entry_data.get('include_in_report', False) else 0,
                    is_important=1 if entry_data.get('is_important', False) else 0,
                    is_completed=1 if entry_data.get('is_completed', False) else 0,
                    is_pinned=1 if entry_data.get('is_pinned', False) else 0,
                    is_archived=1 if entry_data.get('is_archived', False) else 0,
                    created_at=datetime.fromisoformat(entry_data['created_at'])
                    if 'created_at' in entry_data
                    else datetime.utcnow(),
                    updated_at=datetime.fromisoformat(entry_data['updated_at'])
                    if 'updated_at' in entry_data
                    else datetime.utcnow(),
                )
                db.add(entry)
                db.flush()

                # Add entry labels
                for old_label_id in entry_data.get('labels', []):
                    if old_label_id in label_id_mapping:
                        label = db.query(models.Label).filter(models.Label.id == label_id_mapping[old_label_id]).first()
                        if label and label not in entry.labels:
                            entry.labels.append(label)

                data_stats['entries_imported'] += 1

            # Add note labels
            note_labels = note_data.get('labels', note_data.get('tags', []))
            for old_label_id in note_labels:
                if old_label_id in label_id_mapping:
                    label = db.query(models.Label).filter(models.Label.id == label_id_mapping[old_label_id]).first()
                    if label and label not in note.labels:
                        note.labels.append(label)

        db.commit()
        stats['data_restore'] = data_stats

        # Step 2: Restore files from ZIP
        files_content = await files_archive.read()
        zip_buffer = io.BytesIO(files_content)

        files_restored = 0
        files_skipped = 0

        upload_dir = UPLOAD_DIR

        with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
            if zip_file.testzip() is not None:
                raise HTTPException(status_code=400, detail='Corrupted ZIP file')

            for file_info in zip_file.filelist:
                if file_info.is_dir():
                    continue

                filename = os.path.basename(file_info.filename)
                target_path = upload_dir / filename

                if target_path.exists():
                    files_skipped += 1
                    continue

                with zip_file.open(file_info) as source:
                    with open(target_path, 'wb') as target:
                        target.write(source.read())
                files_restored += 1

        stats['files_restore'] = {
            'restored': files_restored,
            'skipped': files_skipped,
            'total': files_restored + files_skipped,
        }

        stats['success'] = True
        stats['message'] = (
            f"Full restore completed: {data_stats['entries_imported']} entries and {files_restored} files restored"
        )

        return stats

    except json.JSONDecodeError:
        db.rollback()
        raise HTTPException(status_code=400, detail='Invalid JSON file')
    except zipfile.BadZipFile:
        db.rollback()
        raise HTTPException(status_code=400, detail='Invalid ZIP file')
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f'Full restore failed: {str(e)}')
