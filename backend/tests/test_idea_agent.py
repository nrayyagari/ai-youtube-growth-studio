import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests.conftest import SAMPLE_CHANNEL, MockRouter, sample_idea_response
from agents.idea_agent import IdeaAgent


def test_idea_agent_prompt_construction():
    agent = IdeaAgent()
    router = MockRouter(sample_idea_response())
    result = agent.process(SAMPLE_CHANNEL, {"topic": "AI tools"}, router)
    assert result["section_type"] == "idea"
    assert "ideas" in result["output"]
    assert len(result["output"]["ideas"]) > 0
    assert result["output"]["ideas"][0]["score"]["total"] == 88


def test_idea_agent_no_topic():
    agent = IdeaAgent()
    router = MockRouter(sample_idea_response())
    result = agent.process(SAMPLE_CHANNEL, {"topic": ""}, router)
    assert result["section_type"] == "idea"
    assert "ideas" in result["output"]


def test_idea_agent_bad_json():
    agent = IdeaAgent()
    router = MockRouter("```json\n{bad json here}\n```")
    result = agent.process(SAMPLE_CHANNEL, {"topic": "test"}, router)
    assert result["section_type"] == "idea"
    assert "raw_output" in result["output"] or "ideas" in result["output"]
