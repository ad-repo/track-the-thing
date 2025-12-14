"""
API routes for LLM integration - Send to LLM feature
"""

import json
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix='/api/llm', tags=['llm'])

# LLM Provider configurations
PROVIDER_CONFIGS = {
    'openai': {
        'url': 'https://api.openai.com/v1/chat/completions',
        'model': 'gpt-4o-mini',
        'key_field': 'openai_api_key',
    },
    'anthropic': {
        'url': 'https://api.anthropic.com/v1/messages',
        'model': 'claude-3-haiku-20240307',
        'key_field': 'anthropic_api_key',
    },
    'gemini': {
        'url': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        'model': 'gemini-1.5-flash',
        'key_field': 'gemini_api_key',
    },
}


def _get_api_key(settings: models.AppSettings, provider: str) -> str:
    """Get API key for the specified provider."""
    key_field = PROVIDER_CONFIGS.get(provider, {}).get('key_field')
    if not key_field:
        raise HTTPException(status_code=400, detail=f'Unknown provider: {provider}')
    return getattr(settings, key_field, '') or ''


async def _call_openai_chat(api_key: str, messages: list[dict], model: str) -> dict:
    """Call OpenAI Chat Completions API."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            'https://api.openai.com/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': model,
                'messages': messages,
                'max_tokens': 2048,
            },
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f'OpenAI API error: {response.text}')
        data = response.json()
        usage = data.get('usage', {})
        return {
            'text': data['choices'][0]['message']['content'],
            'input_tokens': usage.get('prompt_tokens', 0),
            'output_tokens': usage.get('completion_tokens', 0),
        }


async def _call_openai_responses(api_key: str, messages: list[dict], model: str) -> dict:
    """Call OpenAI Responses API (newer format)."""
    # Convert messages to input format for responses API
    # The responses API uses 'input' instead of 'messages'
    input_items = []

    for msg in messages:
        if msg['role'] == 'system':
            # System messages become system instructions
            input_items.append({'type': 'message', 'role': 'system', 'content': msg['content']})
        elif msg['role'] == 'user':
            input_items.append({'type': 'message', 'role': 'user', 'content': msg['content']})
        elif msg['role'] == 'assistant':
            input_items.append({'type': 'message', 'role': 'assistant', 'content': msg['content']})

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            'https://api.openai.com/v1/responses',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': model,
                'input': input_items,
                'max_output_tokens': 2048,
            },
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f'OpenAI Responses API error: {response.text}')
        data = response.json()
        usage = data.get('usage', {})

        # Extract response text from output
        output_text = ''
        for output_item in data.get('output', []):
            if output_item.get('type') == 'message':
                for content in output_item.get('content', []):
                    if content.get('type') == 'output_text':
                        output_text += content.get('text', '')

        return {
            'text': output_text,
            'input_tokens': usage.get('input_tokens', 0),
            'output_tokens': usage.get('output_tokens', 0),
        }


async def _call_anthropic(api_key: str, messages: list[dict], model: str) -> dict:
    """Call Anthropic Messages API."""
    # Anthropic uses a different message format - extract system message if present
    system_msg = None
    chat_messages = []
    for msg in messages:
        if msg['role'] == 'system':
            system_msg = msg['content']
        else:
            chat_messages.append(msg)

    async with httpx.AsyncClient(timeout=60.0) as client:
        payload = {
            'model': model,
            'max_tokens': 2048,
            'messages': chat_messages,
        }
        if system_msg:
            payload['system'] = system_msg

        response = await client.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            json=payload,
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f'Anthropic API error: {response.text}')
        data = response.json()
        usage = data.get('usage', {})
        return {
            'text': data['content'][0]['text'],
            'input_tokens': usage.get('input_tokens', 0),
            'output_tokens': usage.get('output_tokens', 0),
        }


async def _call_gemini(api_key: str, messages: list[dict], model: str) -> dict:
    """Call Google Gemini API."""
    # Convert messages to Gemini format
    contents = []
    system_instruction = None

    for msg in messages:
        if msg['role'] == 'system':
            system_instruction = msg['content']
        else:
            role = 'user' if msg['role'] == 'user' else 'model'
            contents.append({'role': role, 'parts': [{'text': msg['content']}]})

    async with httpx.AsyncClient(timeout=60.0) as client:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
        payload = {'contents': contents}
        if system_instruction:
            payload['systemInstruction'] = {'parts': [{'text': system_instruction}]}

        response = await client.post(url, json=payload)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f'Gemini API error: {response.text}')
        data = response.json()
        usage = data.get('usageMetadata', {})
        return {
            'text': data['candidates'][0]['content']['parts'][0]['text'],
            'input_tokens': usage.get('promptTokenCount', 0),
            'output_tokens': usage.get('candidatesTokenCount', 0),
        }


@router.post('/send', response_model=schemas.LlmSendResponse)
async def send_to_llm(request: schemas.LlmSendRequest, db: Session = Depends(get_db)):
    """Send a prompt to the configured LLM and store the conversation."""

    # Get settings
    settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()
    if not settings:
        raise HTTPException(status_code=400, detail='App settings not configured')

    provider = settings.llm_provider or 'openai'
    api_key = _get_api_key(settings, provider)

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail=f'API key not configured for {provider}. Please add your API key in Settings → AI Integration.',
        )

    # Get or create conversation for this entry
    conversation = db.query(models.LlmConversation).filter(models.LlmConversation.entry_id == request.entry_id).first()

    if not conversation:
        conversation = models.LlmConversation(
            entry_id=request.entry_id,
            messages='[]',
        )
        db.add(conversation)
        db.flush()

    # Parse existing messages
    try:
        messages = json.loads(conversation.messages) if conversation.messages else []
    except json.JSONDecodeError:
        messages = []

    # Build messages array for API call
    api_messages = []

    # Add global prompt as system message if configured
    if settings.llm_global_prompt:
        api_messages.append({'role': 'system', 'content': settings.llm_global_prompt})

    # Add conversation history if continuing
    if request.continue_conversation and messages:
        api_messages.extend(messages)

    # Add current user message
    api_messages.append({'role': 'user', 'content': request.prompt})

    # Call the appropriate LLM API
    config = PROVIDER_CONFIGS[provider]
    openai_api_type = settings.openai_api_type or 'chat_completions'
    try:
        if provider == 'openai':
            if openai_api_type == 'responses':
                llm_result = await _call_openai_responses(api_key, api_messages, config['model'])
            else:
                llm_result = await _call_openai_chat(api_key, api_messages, config['model'])
        elif provider == 'anthropic':
            llm_result = await _call_anthropic(api_key, api_messages, config['model'])
        elif provider == 'gemini':
            llm_result = await _call_gemini(api_key, api_messages, config['model'])
        else:
            raise HTTPException(status_code=400, detail=f'Unsupported provider: {provider}')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'LLM API call failed: {str(e)}')

    response_text = llm_result['text']
    input_tokens = llm_result['input_tokens']
    output_tokens = llm_result['output_tokens']

    # Update conversation history
    messages.append({'role': 'user', 'content': request.prompt})
    messages.append({'role': 'assistant', 'content': response_text})
    conversation.messages = json.dumps(messages)
    conversation.updated_at = datetime.utcnow()

    db.commit()

    return schemas.LlmSendResponse(
        response=response_text,
        conversation_id=conversation.id,
        provider=provider,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )


@router.get('/conversation/{entry_id}', response_model=schemas.LlmConversationResponse | None)
def get_conversation(entry_id: int, db: Session = Depends(get_db)):
    """Get conversation history for an entry."""
    conversation = db.query(models.LlmConversation).filter(models.LlmConversation.entry_id == entry_id).first()

    if not conversation:
        return None

    try:
        messages = json.loads(conversation.messages) if conversation.messages else []
    except json.JSONDecodeError:
        messages = []

    return {
        'id': conversation.id,
        'entry_id': conversation.entry_id,
        'messages': [schemas.LlmMessage(**m) for m in messages],
        'created_at': conversation.created_at,
        'updated_at': conversation.updated_at,
    }


@router.delete('/conversation/{entry_id}')
def clear_conversation(entry_id: int, db: Session = Depends(get_db)):
    """Clear conversation history for an entry."""
    deleted = db.query(models.LlmConversation).filter(models.LlmConversation.entry_id == entry_id).delete()
    db.commit()
    return {'deleted': deleted > 0}


@router.get('/settings', response_model=schemas.LlmSettingsResponse)
def get_llm_settings(db: Session = Depends(get_db)):
    """Get LLM settings (API keys are masked)."""
    settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()

    if not settings:
        return schemas.LlmSettingsResponse()

    return schemas.LlmSettingsResponse(
        llm_provider=settings.llm_provider or 'openai',
        openai_api_type=settings.openai_api_type or 'chat_completions',
        openai_api_key_set=bool(settings.openai_api_key),
        anthropic_api_key_set=bool(settings.anthropic_api_key),
        gemini_api_key_set=bool(settings.gemini_api_key),
        llm_global_prompt=settings.llm_global_prompt or '',
    )
