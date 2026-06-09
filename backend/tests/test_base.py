import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agents.base import BaseAgent
from core.router import AIProviderRouter


class TestAgent(BaseAgent):
    name = "test"

    def process(self, channel, inputs, router):
        return {"output": {}, "section_type": "test"}


def test_base_agent_safe_json_valid():
    agent = TestAgent()
    result = agent._safe_json('{"key": "value", "num": 42}')
    assert result == {"key": "value", "num": 42}


def test_base_agent_safe_json_with_markdown_fence():
    agent = TestAgent()
    result = agent._safe_json('```json\n{"key": "value"}\n```')
    assert result == {"key": "value"}


def test_base_agent_safe_json_with_leading_text():
    agent = TestAgent()
    result = agent._safe_json('Some text here...\n{"real": "json"}\n...more text')
    assert result == {"real": "json"}


def test_base_agent_safe_json_nested():
    agent = TestAgent()
    result = agent._safe_json('{"outer": {"inner": [1, 2, 3]}, "list": ["a", "b"]}')
    assert result["outer"]["inner"] == [1, 2, 3]


def test_base_agent_safe_json_escaped_quotes():
    agent = TestAgent()
    result = agent._safe_json('{"text": "It\'s working now"}')
    assert result["text"] == "It's working now"


def test_base_agent_safe_json_newlines_in_string():
    agent = TestAgent()
    result = agent._safe_json('{"multi": "line1\\nline2\\nline3"}')
    assert result["multi"] == "line1\nline2\nline3"


def test_base_agent_safe_json_completely_broken():
    agent = TestAgent()
    result = agent._safe_json("This is just plain text, no JSON at all!")
    assert "raw_output" in result
    assert result["raw_output"] == "This is just plain text, no JSON at all!"


def test_base_agent_safe_json_empty():
    agent = TestAgent()
    result = agent._safe_json("")
    assert "raw_output" in result
