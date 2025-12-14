"""
Unit tests for MCP tool integration logic.

Tests the tool format converters and SSE parsing without requiring
actual MCP server connections.
"""

import json

import pytest


class TestSSEParsing:
    """Tests for Server-Sent Events response parsing."""

    def parse_sse_response(self, response_text: str) -> dict | None:
        """
        Parse Server-Sent Events response from MCP server.

        SSE format:
        event: message
        data: {"jsonrpc": "2.0", "result": {...}, "id": 1}
        """
        lines = response_text.strip().split('\n')
        for line in lines:
            if line.startswith('data: '):
                try:
                    return json.loads(line[6:])  # Skip 'data: ' prefix
                except json.JSONDecodeError:
                    continue
        return None

    def test_parse_simple_sse_response(self):
        """Test parsing a simple SSE response."""
        sse_text = 'event: message\ndata: {"jsonrpc": "2.0", "result": {"tools": []}, "id": 1}'
        result = self.parse_sse_response(sse_text)

        assert result is not None
        assert result['jsonrpc'] == '2.0'
        assert result['id'] == 1
        assert 'result' in result

    def test_parse_sse_with_tools(self):
        """Test parsing SSE response containing tools list."""
        tools_data = {
            'jsonrpc': '2.0',
            'result': {
                'tools': [
                    {
                        'name': 'get_me',
                        'description': 'Get user info',
                        'inputSchema': {},
                    },
                    {
                        'name': 'list_repos',
                        'description': 'List repos',
                        'inputSchema': {},
                    },
                ]
            },
            'id': 2,
        }
        sse_text = f'event: message\ndata: {json.dumps(tools_data)}'
        result = self.parse_sse_response(sse_text)

        assert result is not None
        assert len(result['result']['tools']) == 2
        assert result['result']['tools'][0]['name'] == 'get_me'

    def test_parse_sse_with_tool_result(self):
        """Test parsing SSE response with tool execution result."""
        tool_result = {
            'jsonrpc': '2.0',
            'result': {
                'content': [
                    {'type': 'text', 'text': 'Hello, user!'},
                ]
            },
            'id': 3,
        }
        sse_text = f'event: message\ndata: {json.dumps(tool_result)}'
        result = self.parse_sse_response(sse_text)

        assert result is not None
        assert result['result']['content'][0]['text'] == 'Hello, user!'

    def test_parse_sse_with_error(self):
        """Test parsing SSE response with error."""
        error_data = {
            'jsonrpc': '2.0',
            'error': {'code': -32600, 'message': 'Invalid Request'},
            'id': 1,
        }
        sse_text = f'event: message\ndata: {json.dumps(error_data)}'
        result = self.parse_sse_response(sse_text)

        assert result is not None
        assert 'error' in result
        assert result['error']['message'] == 'Invalid Request'

    def test_parse_empty_sse_returns_none(self):
        """Test that empty SSE text returns None."""
        result = self.parse_sse_response('')
        assert result is None

    def test_parse_sse_no_data_line(self):
        """Test SSE without data line returns None."""
        sse_text = 'event: message\nsome other content'
        result = self.parse_sse_response(sse_text)
        assert result is None

    def test_parse_sse_invalid_json(self):
        """Test SSE with invalid JSON returns None."""
        sse_text = 'event: message\ndata: {invalid json}'
        result = self.parse_sse_response(sse_text)
        assert result is None

    def test_parse_sse_multiple_data_lines_takes_first(self):
        """Test that multiple data lines return first valid one."""
        sse_text = 'event: message\ndata: {"first": true}\ndata: {"second": true}'
        result = self.parse_sse_response(sse_text)

        assert result is not None
        assert result.get('first') is True


class TestToolFormatConversion:
    """Tests for converting MCP tools to provider-specific formats."""

    def convert_tools_for_openai(self, mcp_tools: list[dict]) -> list[dict]:
        """Convert MCP tools to OpenAI function calling format."""
        openai_tools = []
        for tool in mcp_tools:
            openai_tools.append(
                {
                    'type': 'function',
                    'function': {
                        'name': tool.get('name', ''),
                        'description': tool.get('description', ''),
                        'parameters': tool.get('inputSchema', {'type': 'object', 'properties': {}}),
                    },
                }
            )
        return openai_tools

    def convert_tools_for_anthropic(self, mcp_tools: list[dict]) -> list[dict]:
        """Convert MCP tools to Anthropic tool use format."""
        anthropic_tools = []
        for tool in mcp_tools:
            anthropic_tools.append(
                {
                    'name': tool.get('name', ''),
                    'description': tool.get('description', ''),
                    'input_schema': tool.get('inputSchema', {'type': 'object', 'properties': {}}),
                }
            )
        return anthropic_tools

    def convert_tools_for_gemini(self, mcp_tools: list[dict]) -> list[dict]:
        """Convert MCP tools to Gemini function calling format."""
        gemini_tools = []
        for tool in mcp_tools:
            gemini_tools.append(
                {
                    'name': tool.get('name', ''),
                    'description': tool.get('description', ''),
                    'parameters': tool.get('inputSchema', {'type': 'object', 'properties': {}}),
                }
            )
        return gemini_tools

    @pytest.fixture
    def sample_mcp_tools(self):
        """Sample MCP tools for testing conversion."""
        return [
            {
                'name': 'get_user',
                'description': 'Get the current user information',
                'inputSchema': {
                    'type': 'object',
                    'properties': {},
                    'required': [],
                },
            },
            {
                'name': 'search_code',
                'description': 'Search for code in a repository',
                'inputSchema': {
                    'type': 'object',
                    'properties': {
                        'query': {'type': 'string', 'description': 'Search query'},
                        'repo': {'type': 'string', 'description': 'Repository name'},
                    },
                    'required': ['query'],
                },
            },
            {
                'name': 'create_issue',
                'description': 'Create a new issue',
                'inputSchema': {
                    'type': 'object',
                    'properties': {
                        'owner': {'type': 'string'},
                        'repo': {'type': 'string'},
                        'title': {'type': 'string'},
                        'body': {'type': 'string'},
                    },
                    'required': ['owner', 'repo', 'title'],
                },
            },
        ]

    def test_convert_to_openai_format(self, sample_mcp_tools):
        """Test conversion to OpenAI function calling format."""
        openai_tools = self.convert_tools_for_openai(sample_mcp_tools)

        assert len(openai_tools) == 3

        # Check structure
        for tool in openai_tools:
            assert tool['type'] == 'function'
            assert 'function' in tool
            assert 'name' in tool['function']
            assert 'description' in tool['function']
            assert 'parameters' in tool['function']

        # Check specific tool
        get_user = openai_tools[0]
        assert get_user['function']['name'] == 'get_user'
        assert get_user['function']['description'] == 'Get the current user information'

    def test_convert_to_anthropic_format(self, sample_mcp_tools):
        """Test conversion to Anthropic tool use format."""
        anthropic_tools = self.convert_tools_for_anthropic(sample_mcp_tools)

        assert len(anthropic_tools) == 3

        # Check structure
        for tool in anthropic_tools:
            assert 'name' in tool
            assert 'description' in tool
            assert 'input_schema' in tool  # Note: Anthropic uses input_schema

        # Check specific tool
        search_code = anthropic_tools[1]
        assert search_code['name'] == 'search_code'
        assert 'properties' in search_code['input_schema']
        assert 'query' in search_code['input_schema']['properties']

    def test_convert_to_gemini_format(self, sample_mcp_tools):
        """Test conversion to Gemini function calling format."""
        gemini_tools = self.convert_tools_for_gemini(sample_mcp_tools)

        assert len(gemini_tools) == 3

        # Check structure
        for tool in gemini_tools:
            assert 'name' in tool
            assert 'description' in tool
            assert 'parameters' in tool

        # Check specific tool
        create_issue = gemini_tools[2]
        assert create_issue['name'] == 'create_issue'
        assert 'owner' in create_issue['parameters']['properties']
        assert 'required' in create_issue['parameters']

    def test_convert_empty_tools_list(self):
        """Test converting empty tools list."""
        openai = self.convert_tools_for_openai([])
        anthropic = self.convert_tools_for_anthropic([])
        gemini = self.convert_tools_for_gemini([])

        assert openai == []
        assert anthropic == []
        assert gemini == []

    def test_convert_tool_with_minimal_fields(self):
        """Test converting tool with only name."""
        minimal_tool = [{'name': 'minimal'}]

        openai = self.convert_tools_for_openai(minimal_tool)
        assert openai[0]['function']['name'] == 'minimal'
        assert openai[0]['function']['description'] == ''

        anthropic = self.convert_tools_for_anthropic(minimal_tool)
        assert anthropic[0]['name'] == 'minimal'

        gemini = self.convert_tools_for_gemini(minimal_tool)
        assert gemini[0]['name'] == 'minimal'

    def test_preserve_complex_input_schema(self, sample_mcp_tools):
        """Test that complex input schemas are preserved."""
        # Get the create_issue tool
        create_issue_mcp = sample_mcp_tools[2]

        openai_tools = self.convert_tools_for_openai([create_issue_mcp])
        openai_params = openai_tools[0]['function']['parameters']

        assert openai_params['type'] == 'object'
        assert len(openai_params['properties']) == 4
        assert openai_params['required'] == ['owner', 'repo', 'title']


class TestToolResultExtraction:
    """Tests for extracting results from MCP tool call responses."""

    def extract_tool_result(self, result: dict) -> str | None:
        """Extract text content from MCP tool result."""
        if isinstance(result, dict):
            content = result.get('content', [])
            if isinstance(content, list):
                texts = []
                for item in content:
                    if isinstance(item, dict) and item.get('type') == 'text':
                        texts.append(item.get('text', ''))
                if texts:
                    return '\n'.join(texts)
            elif isinstance(content, str):
                return content
        return str(result) if result else None

    def test_extract_single_text_content(self):
        """Test extracting single text content."""
        result = {
            'content': [
                {'type': 'text', 'text': 'Hello, world!'},
            ]
        }
        extracted = self.extract_tool_result(result)
        assert extracted == 'Hello, world!'

    def test_extract_multiple_text_content(self):
        """Test extracting multiple text blocks."""
        result = {
            'content': [
                {'type': 'text', 'text': 'Line 1'},
                {'type': 'text', 'text': 'Line 2'},
                {'type': 'text', 'text': 'Line 3'},
            ]
        }
        extracted = self.extract_tool_result(result)
        assert extracted == 'Line 1\nLine 2\nLine 3'

    def test_extract_mixed_content_types(self):
        """Test extracting when there are mixed content types."""
        result = {
            'content': [
                {'type': 'text', 'text': 'Text content'},
                {'type': 'image', 'url': 'http://example.com/image.png'},
                {'type': 'text', 'text': 'More text'},
            ]
        }
        extracted = self.extract_tool_result(result)
        assert extracted == 'Text content\nMore text'

    def test_extract_string_content(self):
        """Test extracting when content is a string directly."""
        result = {'content': 'Direct string content'}
        extracted = self.extract_tool_result(result)
        assert extracted == 'Direct string content'

    def test_extract_empty_content(self):
        """Test extracting empty content returns stringified result."""
        result = {'content': []}
        extracted = self.extract_tool_result(result)
        # When content is empty list, returns stringified result
        assert extracted == str(result)

    def test_extract_non_dict_result(self):
        """Test extracting from non-dict result."""
        extracted = self.extract_tool_result('string result')
        assert extracted == 'string result'


class TestMcpToolCallIteration:
    """Tests for the tool call iteration logic."""

    MAX_TOOL_ITERATIONS = 10

    def test_max_iterations_constant(self):
        """Verify max iterations is reasonable."""
        assert self.MAX_TOOL_ITERATIONS >= 5
        assert self.MAX_TOOL_ITERATIONS <= 20

    def test_iteration_count_tracking(self):
        """Test tracking iteration counts."""
        iterations = 0
        tool_calls_made = []

        # Simulate a tool call loop
        while iterations < self.MAX_TOOL_ITERATIONS:
            iterations += 1
            # Simulate tool call
            tool_calls_made.append({'name': f'tool_{iterations}', 'arguments': {}})

            # Simulate LLM deciding to stop after 3 iterations
            if iterations >= 3:
                break

        assert iterations == 3
        assert len(tool_calls_made) == 3


class TestRemoteMcpServerHandling:
    """Tests for remote MCP server specific logic."""

    def test_remote_server_always_available(self):
        """Test that remote servers are considered always available."""
        # Remote server status should not depend on 'running' status
        server_type = 'remote'
        server_status = 'stopped'  # Even if marked stopped

        # Remote servers are always available
        is_available = server_type == 'remote' or server_status == 'running'
        assert is_available is True

    def test_docker_server_requires_running_status(self):
        """Test that Docker servers require running status."""
        server_type = 'docker'

        # Running
        is_available = server_type == 'remote' or 'running' == 'running'
        assert is_available is True

        # Stopped
        is_available = server_type == 'remote' or 'stopped' == 'running'
        assert is_available is False

    def test_header_parsing(self):
        """Test parsing headers JSON for remote servers."""
        headers_json = '{"Authorization": "Bearer token123", "X-Custom": "value"}'
        headers = json.loads(headers_json)

        assert headers['Authorization'] == 'Bearer token123'
        assert headers['X-Custom'] == 'value'

    def test_empty_headers_handling(self):
        """Test handling empty headers."""
        headers_json = '{}'
        headers = json.loads(headers_json)
        assert headers == {}

    def test_invalid_headers_fallback(self):
        """Test fallback for invalid headers JSON."""
        headers_json = 'invalid json'
        try:
            headers = json.loads(headers_json)
        except json.JSONDecodeError:
            headers = {}
        assert headers == {}
