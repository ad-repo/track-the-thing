"""
API routes for application settings (sprint goals, quarterly goals, etc.)
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix='/api/settings', tags=['settings'])


@router.get('', response_model=schemas.AppSettingsResponse)
def get_app_settings(db: Session = Depends(get_db)):
    """Get application settings (sprint goals, quarterly goals, dates)"""
    settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()

    if not settings:
        # Create default settings if they don't exist
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
            texture_enabled=0,
            texture_settings='{}',
            llm_provider='openai',
            openai_api_type='chat_completions',
            openai_api_key='',
            anthropic_api_key='',
            gemini_api_key='',
            llm_global_prompt='',
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return {
        'id': settings.id,
        'sprint_goals': settings.sprint_goals,
        'quarterly_goals': settings.quarterly_goals,
        'sprint_start_date': settings.sprint_start_date or '',
        'sprint_end_date': settings.sprint_end_date or '',
        'quarterly_start_date': settings.quarterly_start_date or '',
        'quarterly_end_date': settings.quarterly_end_date or '',
        'emoji_library': settings.emoji_library or 'emoji-picker-react',
        'sprint_name': settings.sprint_name or 'Sprint',
        'daily_goal_end_time': settings.daily_goal_end_time or '17:00',
        'texture_enabled': bool(settings.texture_enabled),
        'texture_settings': settings.texture_settings or '{}',
        # LLM settings - mask API keys, only show if set
        'llm_provider': getattr(settings, 'llm_provider', None) or 'openai',
        'openai_api_type': getattr(settings, 'openai_api_type', None) or 'chat_completions',
        'openai_api_key_set': bool(getattr(settings, 'openai_api_key', None)),
        'anthropic_api_key_set': bool(getattr(settings, 'anthropic_api_key', None)),
        'gemini_api_key_set': bool(getattr(settings, 'gemini_api_key', None)),
        'llm_global_prompt': getattr(settings, 'llm_global_prompt', None) or '',
        'created_at': settings.created_at.isoformat(),
        'updated_at': settings.updated_at.isoformat(),
    }


@router.patch('', response_model=schemas.AppSettingsResponse)
def update_app_settings(settings_update: schemas.AppSettingsUpdate, db: Session = Depends(get_db)):
    """Update application settings"""
    settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()

    if not settings:
        # Create if doesn't exist
        settings = models.AppSettings(
            id=1,
            sprint_goals=settings_update.sprint_goals or '',
            quarterly_goals=settings_update.quarterly_goals or '',
            sprint_start_date=settings_update.sprint_start_date or '',
            sprint_end_date=settings_update.sprint_end_date or '',
            quarterly_start_date=settings_update.quarterly_start_date or '',
            quarterly_end_date=settings_update.quarterly_end_date or '',
            emoji_library=settings_update.emoji_library or 'emoji-picker-react',
            sprint_name=settings_update.sprint_name or 'Sprint',
            daily_goal_end_time=settings_update.daily_goal_end_time or '17:00',
            texture_enabled=int(settings_update.texture_enabled) if settings_update.texture_enabled is not None else 0,
            texture_settings=settings_update.texture_settings or '{}',
        )
        db.add(settings)
    else:
        # Update existing
        if settings_update.sprint_goals is not None:
            settings.sprint_goals = settings_update.sprint_goals
        if settings_update.quarterly_goals is not None:
            settings.quarterly_goals = settings_update.quarterly_goals
        if settings_update.sprint_start_date is not None:
            settings.sprint_start_date = settings_update.sprint_start_date
        if settings_update.sprint_end_date is not None:
            settings.sprint_end_date = settings_update.sprint_end_date
        if settings_update.quarterly_start_date is not None:
            settings.quarterly_start_date = settings_update.quarterly_start_date
        if settings_update.quarterly_end_date is not None:
            settings.quarterly_end_date = settings_update.quarterly_end_date
        if settings_update.emoji_library is not None:
            settings.emoji_library = settings_update.emoji_library
        if settings_update.sprint_name is not None:
            settings.sprint_name = settings_update.sprint_name
        if settings_update.daily_goal_end_time is not None:
            settings.daily_goal_end_time = settings_update.daily_goal_end_time
        if settings_update.texture_enabled is not None:
            settings.texture_enabled = int(settings_update.texture_enabled)
        if settings_update.texture_settings is not None:
            settings.texture_settings = settings_update.texture_settings
        # LLM settings
        if settings_update.llm_provider is not None:
            settings.llm_provider = settings_update.llm_provider
        if settings_update.openai_api_type is not None:
            settings.openai_api_type = settings_update.openai_api_type
        if settings_update.openai_api_key is not None:
            settings.openai_api_key = settings_update.openai_api_key
        if settings_update.anthropic_api_key is not None:
            settings.anthropic_api_key = settings_update.anthropic_api_key
        if settings_update.gemini_api_key is not None:
            settings.gemini_api_key = settings_update.gemini_api_key
        if settings_update.llm_global_prompt is not None:
            settings.llm_global_prompt = settings_update.llm_global_prompt

    db.commit()
    db.refresh(settings)
    return {
        'id': settings.id,
        'sprint_goals': settings.sprint_goals,
        'quarterly_goals': settings.quarterly_goals,
        'sprint_start_date': settings.sprint_start_date or '',
        'sprint_end_date': settings.sprint_end_date or '',
        'quarterly_start_date': settings.quarterly_start_date or '',
        'quarterly_end_date': settings.quarterly_end_date or '',
        'emoji_library': settings.emoji_library or 'emoji-picker-react',
        'sprint_name': settings.sprint_name or 'Sprint',
        'daily_goal_end_time': settings.daily_goal_end_time or '17:00',
        'texture_enabled': bool(settings.texture_enabled),
        'texture_settings': settings.texture_settings or '{}',
        # LLM settings - mask API keys, only show if set
        'llm_provider': getattr(settings, 'llm_provider', None) or 'openai',
        'openai_api_type': getattr(settings, 'openai_api_type', None) or 'chat_completions',
        'openai_api_key_set': bool(getattr(settings, 'openai_api_key', None)),
        'anthropic_api_key_set': bool(getattr(settings, 'anthropic_api_key', None)),
        'gemini_api_key_set': bool(getattr(settings, 'gemini_api_key', None)),
        'llm_global_prompt': getattr(settings, 'llm_global_prompt', None) or '',
        'created_at': settings.created_at.isoformat(),
        'updated_at': settings.updated_at.isoformat(),
    }
