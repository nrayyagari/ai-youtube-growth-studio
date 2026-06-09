import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests.conftest import SAMPLE_CHANNEL, MockRouter
from agents.visual_agent import VisualAgent
from agents.music_agent import MusicAgent
from agents.title_agent import TitleAgent
from agents.thumbnail_agent import ThumbnailAgent
from agents.qa_agent import QAAgent


def test_visual_agent():
    agent = VisualAgent()
    router = MockRouter({"scenes": [{"scene": 1, "description": "Opening", "duration": 10}]})
    result = agent.process(SAMPLE_CHANNEL, {"topic": "AI"}, router)
    assert result["section_type"] == "visual"
    assert "scenes" in result["output"]

def test_music_agent():
    agent = MusicAgent()
    router = MockRouter({"genre": "ambient", "mood": "calm", "score": {"overall": 80}})
    result = agent.process(SAMPLE_CHANNEL, {}, router)
    assert result["section_type"] == "music"

def test_title_agent():
    agent = TitleAgent()
    router = MockRouter({"titles": [{"title": "Best Title Ever"}], "recommended_title": "Best Title Ever", "title_score": {"score": 85}})
    result = agent.process(SAMPLE_CHANNEL, {"topic": "AI", "script": "test"}, router)
    assert result["section_type"] == "titles"
    assert "titles" in result["output"]

def test_thumbnail_agent():
    agent = ThumbnailAgent()
    router = MockRouter({"thumbnail_concepts": [{"concept_name": "Test", "description": "A test thumbnail", "text_overlay": "WOW"}], "score": {"thumbnail_quality": {"score": 90}}})
    result = agent.process(SAMPLE_CHANNEL, {"title": "Test", "idea": "Testing"}, router)
    assert result["section_type"] == "thumbnail"
    assert len(result["output"]["thumbnail_concepts"]) > 0

def test_qa_agent():
    agent = QAAgent()
    router = MockRouter({"checks": [{"type": "copyright", "score": 95, "status": "pass"}, {"type": "monetization", "score": 90, "status": "pass"}]})
    result = agent.process(SAMPLE_CHANNEL, {"topic": "AI", "script": "test", "titles": "T", "thumbnails": "TN"}, router)
    assert result["section_type"] == "qa_report"
    assert len(result["output"]["checks"]) > 0
