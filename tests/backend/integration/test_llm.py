"""Tests for LLM integration endpoints."""

import pytest


@pytest.fixture
def init_app_settings(client):
    """Ensure app_settings exist before LLM tests."""
    # Get settings first to auto-create if needed
    client.get('/api/settings')


def test_get_llm_settings_empty(client, init_app_settings):
    """Test getting LLM settings when none configured."""
    response = client.get('/api/llm/settings')
    assert response.status_code == 200
    data = response.json()
    assert data['llm_provider'] == 'openai'
    assert data['openai_api_key_set'] is False
    assert data['anthropic_api_key_set'] is False
    assert data['gemini_api_key_set'] is False
    assert data['llm_global_prompt'] == ''


def test_send_without_api_key(client, sample_note_entry, init_app_settings):
    """Test sending to LLM without API key configured."""
    response = client.post(
        '/api/llm/send',
        json={
            'entry_id': sample_note_entry.id,
            'prompt': 'Hello',
        },
    )
    assert response.status_code == 400
    assert 'API key not configured' in response.json()['detail']


def test_get_conversation_not_found(client):
    """Test getting non-existent conversation."""
    response = client.get('/api/llm/conversation/999')
    assert response.status_code == 200
    assert response.json() is None


def test_clear_conversation_not_found(client):
    """Test clearing non-existent conversation."""
    response = client.delete('/api/llm/conversation/999')
    assert response.status_code == 200
    assert response.json()['deleted'] is False


def test_llm_settings_in_app_settings(client, init_app_settings):
    """Test LLM settings are included in app settings response."""
    response = client.get('/api/settings')
    assert response.status_code == 200
    data = response.json()
    assert 'llm_provider' in data
    assert 'openai_api_key_set' in data
    assert 'anthropic_api_key_set' in data
    assert 'gemini_api_key_set' in data
    assert 'llm_global_prompt' in data


def test_update_llm_settings(client, init_app_settings):
    """Test updating LLM settings."""
    # Update LLM provider
    response = client.patch(
        '/api/settings',
        json={
            'llm_provider': 'anthropic',
            'llm_global_prompt': 'Be concise.',
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data['llm_provider'] == 'anthropic'
    assert data['llm_global_prompt'] == 'Be concise.'


def test_update_api_key_masked(client, init_app_settings):
    """Test that API keys are masked in response."""
    # Set an API key
    response = client.patch(
        '/api/settings',
        json={
            'openai_api_key': 'sk-test-key-12345',
        },
    )
    assert response.status_code == 200
    data = response.json()
    # Key should be indicated as set, but value should not be returned
    assert data['openai_api_key_set'] is True
    # The actual key should never appear in the response
    assert 'sk-test-key-12345' not in str(data)


def test_openai_api_type_setting(client, init_app_settings):
    """Test updating OpenAI API type setting."""
    # Default should be chat_completions
    response = client.get('/api/settings')
    assert response.status_code == 200
    assert response.json()['openai_api_type'] == 'chat_completions'

    # Update to responses API
    response = client.patch(
        '/api/settings',
        json={
            'openai_api_type': 'responses',
        },
    )
    assert response.status_code == 200
    assert response.json()['openai_api_type'] == 'responses'

    # Verify LLM settings endpoint also returns it
    response = client.get('/api/llm/settings')
    assert response.status_code == 200
    assert response.json()['openai_api_type'] == 'responses'
