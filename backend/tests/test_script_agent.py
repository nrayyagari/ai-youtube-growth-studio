import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests.conftest import SAMPLE_CHANNEL, MockRouter
from agents.script_agent import ScriptAgent

SCRIPT_RESPONSE = {
    "script": "Here's how AI is transforming workplaces...",
    "score": {
        "script_quality": {"score": 85, "explanation": "Good"},
        "retention": {"score": 82, "explanation": "Decent"},
        "monetization": {"score": 90, "explanation": "Safe"},
        "factual_accuracy": {"score": 88, "explanation": "Accurate"},
    },
}

def test_script_agent_output():
    agent = ScriptAgent()
    router = MockRouter(SCRIPT_RESPONSE)
    result = agent.process(SAMPLE_CHANNEL, {"script": "", "topic": "AI"}, router)
    assert result["section_type"] == "script"
    assert "script" in result["output"]

def test_script_agent_bad_json():
    agent = ScriptAgent()
    router = MockRouter("not json at all")
    result = agent.process(SAMPLE_CHANNEL, {"script": "", "topic": "test"}, router)
    assert result["section_type"] == "script"
