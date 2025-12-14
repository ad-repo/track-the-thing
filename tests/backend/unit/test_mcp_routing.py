"""
Unit tests for MCP routing logic
"""

import re


def find_matching_mcp_pattern(text: str, rules: list[dict]) -> dict | None:
    """
    Test helper: Find MCP server matching the input text.
    Rules are checked in priority order (highest first).
    """
    # Sort by priority descending
    sorted_rules = sorted(rules, key=lambda r: r.get('priority', 0), reverse=True)

    for rule in sorted_rules:
        if not rule.get('is_enabled', True):
            continue
        try:
            if re.search(rule['pattern'], text, re.IGNORECASE):
                return rule
        except re.error:
            continue

    return None


class TestMcpPatternMatching:
    """Tests for MCP pattern matching logic."""

    def test_simple_pattern_match(self):
        """Test basic keyword matching."""
        rules = [
            {
                'pattern': 'summarize',
                'priority': 100,
                'is_enabled': True,
                'server': 'summarizer',
            },
        ]
        result = find_matching_mcp_pattern('Please summarize this text', rules)
        assert result is not None
        assert result['server'] == 'summarizer'

    def test_regex_or_pattern(self):
        """Test regex OR pattern matching."""
        rules = [
            {
                'pattern': 'summarize|summary|tldr',
                'priority': 100,
                'is_enabled': True,
                'server': 'summarizer',
            },
        ]

        assert find_matching_mcp_pattern('Give me a summary', rules) is not None
        assert find_matching_mcp_pattern('Can you summarize?', rules) is not None
        assert find_matching_mcp_pattern('TLDR please', rules) is not None
        assert find_matching_mcp_pattern('Hello world', rules) is None

    def test_case_insensitive_matching(self):
        """Test that matching is case insensitive."""
        rules = [
            {
                'pattern': 'translate',
                'priority': 100,
                'is_enabled': True,
                'server': 'translator',
            },
        ]

        assert find_matching_mcp_pattern('TRANSLATE this', rules) is not None
        assert find_matching_mcp_pattern('Translate this', rules) is not None
        assert find_matching_mcp_pattern('translate this', rules) is not None

    def test_priority_ordering(self):
        """Test that higher priority rules are checked first."""
        rules = [
            {'pattern': '.*', 'priority': 0, 'is_enabled': True, 'server': 'catch-all'},
            {
                'pattern': 'summarize',
                'priority': 100,
                'is_enabled': True,
                'server': 'summarizer',
            },
        ]

        # Summarize should match the higher priority rule
        result = find_matching_mcp_pattern('Please summarize this', rules)
        assert result['server'] == 'summarizer'

        # Random text should match the catch-all
        result = find_matching_mcp_pattern('Hello world', rules)
        assert result['server'] == 'catch-all'

    def test_disabled_rules_ignored(self):
        """Test that disabled rules are not matched."""
        rules = [
            {
                'pattern': 'summarize',
                'priority': 100,
                'is_enabled': False,
                'server': 'summarizer',
            },
            {'pattern': '.*', 'priority': 0, 'is_enabled': True, 'server': 'catch-all'},
        ]

        # Should skip disabled summarizer and hit catch-all
        result = find_matching_mcp_pattern('Please summarize this', rules)
        assert result['server'] == 'catch-all'

    def test_no_match_returns_none(self):
        """Test that no match returns None."""
        rules = [
            {
                'pattern': 'summarize',
                'priority': 100,
                'is_enabled': True,
                'server': 'summarizer',
            },
        ]

        result = find_matching_mcp_pattern('Hello world', rules)
        assert result is None

    def test_invalid_regex_skipped(self):
        """Test that invalid regex patterns are skipped."""
        rules = [
            {
                'pattern': '[invalid(regex',
                'priority': 100,
                'is_enabled': True,
                'server': 'bad',
            },
            {'pattern': 'hello', 'priority': 50, 'is_enabled': True, 'server': 'good'},
        ]

        # Should skip invalid pattern and match the valid one
        result = find_matching_mcp_pattern('hello world', rules)
        assert result is not None
        assert result['server'] == 'good'

    def test_empty_text(self):
        """Test matching empty text."""
        rules = [
            {'pattern': '.*', 'priority': 0, 'is_enabled': True, 'server': 'catch-all'},
        ]

        result = find_matching_mcp_pattern('', rules)
        assert result is not None  # .* matches empty string

    def test_multiple_patterns_first_high_priority_wins(self):
        """Test that first matching high priority rule wins."""
        rules = [
            {
                'pattern': 'code|debug',
                'priority': 80,
                'is_enabled': True,
                'server': 'code-helper',
            },
            {
                'pattern': 'translate|translation',
                'priority': 90,
                'is_enabled': True,
                'server': 'translator',
            },
            {
                'pattern': 'summarize|summary',
                'priority': 100,
                'is_enabled': True,
                'server': 'summarizer',
            },
        ]

        # Text that matches multiple patterns should use highest priority
        result = find_matching_mcp_pattern('summarize and translate this code', rules)
        assert result['server'] == 'summarizer'


class TestLogRedaction:
    """Tests for log redaction patterns."""

    REDACT_PATTERNS = [
        r'sk-[a-zA-Z0-9]{20,}',  # OpenAI keys
        r'sk-ant-[a-zA-Z0-9-]+',  # Anthropic keys
        r'AIza[a-zA-Z0-9_-]{30,}',  # Google API keys (typically 39 chars total)
    ]

    def _redact(self, text: str) -> str:
        """Redact sensitive patterns from text."""
        result = text
        for pattern in self.REDACT_PATTERNS:
            result = re.sub(pattern, '[REDACTED]', result)
        return result

    def test_redact_openai_key(self):
        """Test OpenAI key redaction."""
        log = 'Using API key: sk-abcdefghijklmnopqrstuvwxyz123456'
        redacted = self._redact(log)
        assert 'sk-abc' not in redacted
        assert '[REDACTED]' in redacted

    def test_redact_anthropic_key(self):
        """Test Anthropic key redaction."""
        log = 'Authorization: sk-ant-api03-abcdefghijklmnop'
        redacted = self._redact(log)
        assert 'sk-ant' not in redacted
        assert '[REDACTED]' in redacted

    def test_redact_google_key(self):
        """Test Google API key redaction."""
        log = 'API Key: AIzaSyAbcdefghijklmnopqrstuvwxyz12345'
        redacted = self._redact(log)
        assert 'AIza' not in redacted
        assert '[REDACTED]' in redacted

    def test_no_redaction_needed(self):
        """Test that non-sensitive text is not modified."""
        log = 'Processing request from user 123'
        redacted = self._redact(log)
        assert redacted == log
