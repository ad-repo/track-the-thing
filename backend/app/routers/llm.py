"""
API routes for LLM integration - Send to LLM feature

Supports both traditional LLM providers (OpenAI, Anthropic, Gemini) and
MCP (Model Context Protocol) servers for local AI processing.

MCP Tool Integration:
When an MCP server is matched via routing rules, the LLM is given access
to the MCP server's tools. The flow is:
1. Get tools from MCP server (tools/list)
2. Send user request to LLM with tool definitions
3. If LLM wants to call a tool, execute via MCP (tools/call)
4. Send tool results back to LLM
5. Return final LLM response
"""

import json
import re
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services.docker_bridge import DockerBridge

router = APIRouter(prefix='/api/llm', tags=['llm'])

# Maximum number of tool call iterations to prevent infinite loops
MAX_TOOL_ITERATIONS = 10

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


def _find_matching_mcp(text: str, db: Session) -> models.McpServer | None:
    """
    Find MCP server matching the input text.
    Rules are checked in priority order (highest first).

    For Docker servers: must have status 'running'
    For Remote servers: always available (no container to start)
    """
    rules = (
        db.query(models.McpRoutingRule)
        .filter(models.McpRoutingRule.is_enabled == 1)
        .order_by(models.McpRoutingRule.priority.desc())
        .all()
    )

    for rule in rules:
        try:
            if re.search(rule.pattern, text, re.IGNORECASE):
                server = db.query(models.McpServer).filter(models.McpServer.id == rule.mcp_server_id).first()
                if server:
                    server_type = getattr(server, 'server_type', 'docker') or 'docker'
                    # Remote servers are always available
                    if server_type == 'remote':
                        return server
                    # Docker servers must be running
                    if server.status == 'running':
                        return server
        except re.error:
            # Invalid regex pattern, skip this rule
            continue

    return None


def _is_mcp_enabled(settings: models.AppSettings) -> bool:
    """Check if MCP is enabled in settings."""
    return bool(getattr(settings, 'mcp_enabled', 0))


def _should_fallback_to_llm(settings: models.AppSettings) -> bool:
    """Check if should fallback to LLM when MCP fails."""
    return bool(getattr(settings, 'mcp_fallback_to_llm', 1))


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


# Tool-enabled LLM call functions


async def _call_openai_with_tools(api_key: str, messages: list[dict], model: str, tools: list[dict]) -> dict:
    """
    Call OpenAI Chat Completions API with tool definitions.

    Returns dict with:
    - text: response text (if no tool call)
    - tool_calls: list of tool calls (if LLM wants to use tools)
    - input_tokens, output_tokens
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        payload = {
            'model': model,
            'messages': messages,
            'max_tokens': 2048,
        }
        if tools:
            payload['tools'] = tools
            payload['tool_choice'] = 'auto'

        response = await client.post(
            'https://api.openai.com/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json=payload,
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f'OpenAI API error: {response.text}')

        data = response.json()
        usage = data.get('usage', {})
        message = data['choices'][0]['message']

        result = {
            'input_tokens': usage.get('prompt_tokens', 0),
            'output_tokens': usage.get('completion_tokens', 0),
            'message': message,  # Keep full message for conversation continuation
        }

        # Check if LLM wants to call tools
        if message.get('tool_calls'):
            result['tool_calls'] = [
                {
                    'id': tc['id'],
                    'name': tc['function']['name'],
                    'arguments': json.loads(tc['function']['arguments']),
                }
                for tc in message['tool_calls']
            ]
        else:
            result['text'] = message.get('content', '')

        return result


async def _call_anthropic_with_tools(api_key: str, messages: list[dict], model: str, tools: list[dict]) -> dict:
    """
    Call Anthropic Messages API with tool definitions.
    """
    # Anthropic uses a different message format - extract system message if present
    system_msg = None
    chat_messages = []
    for msg in messages:
        if msg['role'] == 'system':
            system_msg = msg['content']
        elif msg['role'] == 'tool':
            # Convert tool result to Anthropic format
            chat_messages.append(
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'tool_result',
                            'tool_use_id': msg.get('tool_call_id', ''),
                            'content': msg['content'],
                        }
                    ],
                }
            )
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
        if tools:
            payload['tools'] = tools

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

        result = {
            'input_tokens': usage.get('input_tokens', 0),
            'output_tokens': usage.get('output_tokens', 0),
            'stop_reason': data.get('stop_reason', ''),
        }

        # Check for tool use in response
        tool_calls = []
        text_parts = []

        for block in data.get('content', []):
            if block.get('type') == 'tool_use':
                tool_calls.append(
                    {
                        'id': block['id'],
                        'name': block['name'],
                        'arguments': block.get('input', {}),
                    }
                )
            elif block.get('type') == 'text':
                text_parts.append(block.get('text', ''))

        if tool_calls:
            result['tool_calls'] = tool_calls
            result['content'] = data.get('content', [])  # Keep for conversation

        result['text'] = ''.join(text_parts)

        return result


async def _call_gemini_with_tools(api_key: str, messages: list[dict], model: str, tools: list[dict]) -> dict:
    """
    Call Google Gemini API with function calling.
    """
    # Convert messages to Gemini format
    contents = []
    system_instruction = None

    for msg in messages:
        if msg['role'] == 'system':
            system_instruction = msg['content']
        elif msg['role'] == 'function':
            # Function response
            contents.append(
                {
                    'role': 'function',
                    'parts': [
                        {
                            'functionResponse': {
                                'name': msg.get('name', ''),
                                'response': {'result': msg['content']},
                            }
                        }
                    ],
                }
            )
        else:
            role = 'user' if msg['role'] == 'user' else 'model'
            contents.append({'role': role, 'parts': [{'text': msg['content']}]})

    async with httpx.AsyncClient(timeout=60.0) as client:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
        payload = {'contents': contents}
        if system_instruction:
            payload['systemInstruction'] = {'parts': [{'text': system_instruction}]}
        if tools:
            payload['tools'] = [{'functionDeclarations': tools}]

        response = await client.post(url, json=payload)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f'Gemini API error: {response.text}')

        data = response.json()
        usage = data.get('usageMetadata', {})

        result = {
            'input_tokens': usage.get('promptTokenCount', 0),
            'output_tokens': usage.get('candidatesTokenCount', 0),
        }

        # Check for function calls
        candidate = data.get('candidates', [{}])[0]
        content = candidate.get('content', {})
        parts = content.get('parts', [])

        tool_calls = []
        text_parts = []

        for part in parts:
            if 'functionCall' in part:
                fc = part['functionCall']
                tool_calls.append(
                    {
                        'id': fc.get('name', ''),  # Gemini doesn't use IDs, use name
                        'name': fc.get('name', ''),
                        'arguments': fc.get('args', {}),
                    }
                )
            elif 'text' in part:
                text_parts.append(part['text'])

        if tool_calls:
            result['tool_calls'] = tool_calls

        result['text'] = ''.join(text_parts)

        return result


async def _execute_mcp_tool_calls(
    bridge: DockerBridge,
    server: models.McpServer,
    tool_calls: list[dict],
) -> list[dict]:
    """
    Execute multiple MCP tool calls and return results.

    Returns list of dicts with:
    - tool_call_id
    - name
    - result or error
    """
    results = []
    for tc in tool_calls:
        result, error = await bridge.call_tool(server, tc['name'], tc['arguments'])
        results.append(
            {
                'tool_call_id': tc['id'],
                'name': tc['name'],
                'result': str(result) if result else '',
                'error': error,
            }
        )
    return results


async def _call_llm_with_mcp_tools(
    settings: models.AppSettings,
    bridge: DockerBridge,
    mcp_server: models.McpServer,
    messages: list[dict],
    mcp_tools: list[dict],
) -> dict:
    """
    Call LLM with MCP tools, handling the tool call loop.

    This function:
    1. Converts MCP tools to provider format
    2. Calls LLM with tools
    3. If LLM wants to use tools, executes them via MCP
    4. Sends results back to LLM
    5. Repeats until LLM gives final response or max iterations

    Returns dict with:
    - text: final response
    - input_tokens, output_tokens: cumulative token usage
    - tool_calls_made: list of tools that were called
    """
    provider = settings.llm_provider or 'openai'
    api_key = _get_api_key(settings, provider)

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail=f'API key not configured for {provider}. MCP tool calling requires an LLM.',
        )

    config = PROVIDER_CONFIGS[provider]
    model = config['model']

    # Convert MCP tools to provider format
    if provider == 'openai':
        provider_tools = bridge.convert_tools_for_openai(mcp_tools)
    elif provider == 'anthropic':
        provider_tools = bridge.convert_tools_for_anthropic(mcp_tools)
    elif provider == 'gemini':
        provider_tools = bridge.convert_tools_for_gemini(mcp_tools)
    else:
        raise HTTPException(status_code=400, detail=f'Unsupported provider for tools: {provider}')

    total_input_tokens = 0
    total_output_tokens = 0
    tool_calls_made = []
    current_messages = messages.copy()

    for iteration in range(MAX_TOOL_ITERATIONS):
        print(f'[MCP Tools] Iteration {iteration + 1}, messages: {len(current_messages)}')

        # Call LLM with tools
        if provider == 'openai':
            result = await _call_openai_with_tools(api_key, current_messages, model, provider_tools)
        elif provider == 'anthropic':
            result = await _call_anthropic_with_tools(api_key, current_messages, model, provider_tools)
        elif provider == 'gemini':
            result = await _call_gemini_with_tools(api_key, current_messages, model, provider_tools)
        else:
            raise HTTPException(status_code=400, detail=f'Unsupported provider: {provider}')

        total_input_tokens += result.get('input_tokens', 0)
        total_output_tokens += result.get('output_tokens', 0)

        # Check if LLM wants to call tools
        if not result.get('tool_calls'):
            # No more tool calls, return final response
            print(f'[MCP Tools] Final response received after {iteration + 1} iterations')
            return {
                'text': result.get('text', ''),
                'input_tokens': total_input_tokens,
                'output_tokens': total_output_tokens,
                'tool_calls_made': tool_calls_made,
            }

        # Execute tool calls
        print(f'[MCP Tools] Executing {len(result["tool_calls"])} tool calls')
        tool_results = await _execute_mcp_tool_calls(bridge, mcp_server, result['tool_calls'])

        for tr in tool_results:
            tool_calls_made.append({'name': tr['name'], 'error': tr.get('error')})

        # Add assistant message and tool results to conversation
        if provider == 'openai':
            # Add assistant message with tool calls
            current_messages.append(result['message'])
            # Add tool results
            for tr in tool_results:
                current_messages.append(
                    {
                        'role': 'tool',
                        'tool_call_id': tr['tool_call_id'],
                        'content': tr['result'] if not tr['error'] else f"Error: {tr['error']}",
                    }
                )
        elif provider == 'anthropic':
            # Add assistant message with tool use
            current_messages.append(
                {
                    'role': 'assistant',
                    'content': result.get('content', []),
                }
            )
            # Add tool results
            for tr in tool_results:
                current_messages.append(
                    {
                        'role': 'tool',
                        'tool_call_id': tr['tool_call_id'],
                        'content': tr['result'] if not tr['error'] else f"Error: {tr['error']}",
                    }
                )
        elif provider == 'gemini':
            # Add model response
            current_messages.append(
                {
                    'role': 'assistant',
                    'content': result.get('text', ''),
                }
            )
            # Add function responses
            for tr in tool_results:
                current_messages.append(
                    {
                        'role': 'function',
                        'name': tr['name'],
                        'content': tr['result'] if not tr['error'] else f"Error: {tr['error']}",
                    }
                )

    # Max iterations reached
    print(f'[MCP Tools] Max iterations ({MAX_TOOL_ITERATIONS}) reached')
    return {
        'text': result.get('text', 'Maximum tool iterations reached.'),
        'input_tokens': total_input_tokens,
        'output_tokens': total_output_tokens,
        'tool_calls_made': tool_calls_made,
    }


@router.post('/send', response_model=schemas.LlmSendResponse)
async def send_to_llm(request: schemas.LlmSendRequest, db: Session = Depends(get_db)):
    """
    Send a prompt to the configured LLM and store the conversation.

    Enhanced with MCP tool integration:
    1. Check if MCP is enabled
    2. Match text against routing rules (by priority)
    3. If match found -> get MCP server tools
    4. Send request to LLM with MCP tools
    5. Handle tool call loop (LLM calls MCP tools, gets results, continues)
    6. Return final LLM response

    Fallback: If MCP fails and fallback is enabled -> use LLM without tools
    """

    # Get settings
    settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()
    if not settings:
        raise HTTPException(status_code=400, detail='App settings not configured')

    # Check for MCP routing first
    mcp_server_name = None
    mcp_error = None

    if _is_mcp_enabled(settings):
        matched_server = _find_matching_mcp(request.prompt, db)
        print(f'[MCP Debug] MCP enabled, matched_server: {matched_server.name if matched_server else None}')

        if matched_server:
            bridge = DockerBridge(db)

            try:
                # Get tools from MCP server
                print(f'[MCP Debug] Getting tools from MCP server: {matched_server.name}')
                mcp_tools, tools_error = await bridge.list_tools(matched_server)

                if tools_error:
                    print(f'[MCP Debug] Failed to get tools: {tools_error}')
                    mcp_error = tools_error
                elif not mcp_tools:
                    print('[MCP Debug] MCP server has no tools, falling back')
                    mcp_error = 'MCP server has no tools available'
                else:
                    print(f'[MCP Debug] Got {len(mcp_tools)} tools from MCP server')

                    # Get or create conversation for this entry
                    conversation = (
                        db.query(models.LlmConversation)
                        .filter(models.LlmConversation.entry_id == request.entry_id)
                        .first()
                    )

                    if not conversation:
                        conversation = models.LlmConversation(
                            entry_id=request.entry_id,
                            messages='[]',
                        )
                        db.add(conversation)
                        db.flush()

                    # Parse existing messages
                    try:
                        existing_messages = json.loads(conversation.messages) if conversation.messages else []
                    except json.JSONDecodeError:
                        existing_messages = []

                    # Build messages array for API call
                    api_messages = []

                    # Add global prompt as system message if configured
                    if settings.llm_global_prompt:
                        api_messages.append({'role': 'system', 'content': settings.llm_global_prompt})

                    # Add MCP context to system message
                    mcp_context = (
                        f"\n\nYou have access to tools from the '{matched_server.name}' MCP server. "
                        f"Use these tools to help answer the user's request."
                    )
                    if api_messages and api_messages[0]['role'] == 'system':
                        api_messages[0]['content'] += mcp_context
                    else:
                        api_messages.insert(0, {'role': 'system', 'content': mcp_context.strip()})

                    # Add conversation history if continuing
                    if request.continue_conversation and existing_messages:
                        # Only include text messages, not tool calls
                        for msg in existing_messages:
                            if msg.get('role') in ('user', 'assistant'):
                                api_messages.append({'role': msg['role'], 'content': msg.get('content', '')})

                    # Add current user message
                    api_messages.append({'role': 'user', 'content': request.prompt})

                    # Call LLM with MCP tools
                    llm_result = await _call_llm_with_mcp_tools(
                        settings,
                        bridge,
                        matched_server,
                        api_messages,
                        mcp_tools,
                    )

                    response_text = llm_result['text']
                    input_tokens = llm_result['input_tokens']
                    output_tokens = llm_result['output_tokens']
                    tool_calls_made = llm_result.get('tool_calls_made', [])

                    mcp_server_name = matched_server.name
                    print(
                        f'[MCP Debug] LLM response via MCP tools: {len(response_text)} chars, {len(tool_calls_made)} tools called'
                    )

                    # Update conversation history (just user and final assistant messages)
                    existing_messages.append({'role': 'user', 'content': request.prompt})
                    existing_messages.append({'role': 'assistant', 'content': response_text})
                    conversation.messages = json.dumps(existing_messages)
                    conversation.updated_at = datetime.utcnow()

                    db.commit()

                    return schemas.LlmSendResponse(
                        response=response_text,
                        conversation_id=conversation.id,
                        provider=f'mcp:{mcp_server_name}',
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                    )

            except Exception as e:
                import traceback

                traceback.print_exc()
                mcp_error = str(e)

            # If MCP failed and fallback is disabled, raise error
            if mcp_error and not _should_fallback_to_llm(settings):
                raise HTTPException(status_code=500, detail=f'MCP server error: {mcp_error}')

            # Log fallback
            if mcp_error:
                print(f'[MCP Debug] Falling back to regular LLM due to error: {mcp_error}')

    # Fallback to traditional LLM provider
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


@router.post('/check-mcp-match')
def check_mcp_match(request: schemas.LlmSendRequest, db: Session = Depends(get_db)):
    """
    Check if a text would be routed to an MCP server.
    Used by frontend to show MCP routing indicator.
    """
    settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()

    if not settings or not _is_mcp_enabled(settings):
        return {'matched': False, 'mcp_enabled': False}

    matched_server = _find_matching_mcp(request.prompt, db)

    if matched_server:
        server_type = getattr(matched_server, 'server_type', 'docker') or 'docker'
        # Remote servers are always considered 'running' (always available)
        effective_status = 'running' if server_type == 'remote' else matched_server.status

        return {
            'matched': True,
            'mcp_enabled': True,
            'server_name': matched_server.name,
            'server_status': effective_status,
            'server_type': server_type,
            'description': matched_server.description,
        }

    return {'matched': False, 'mcp_enabled': True}
