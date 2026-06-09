import json
import pytest
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tests.conftest import SAMPLE_CHANNEL, FullMockRouter, sample_idea_response, sample_script_response, sample_music_response, sample_qa_response


@pytest.fixture(autouse=True)
def patch_sleep(monkeypatch):
    monkeypatch.setattr(time, "sleep", lambda secs: None)
from core.pipeline import PipelineRunner, PipelineError


def test_pipeline_full_run_all_agents():
    router = FullMockRouter()
    pipeline = PipelineRunner(router)
    result = pipeline.run(SAMPLE_CHANNEL, "AI tools")
    assert len(result["sections"]) == 7
    assert "approval" in result
    assert result["approval"]["status"] in ("APPROVED", "NEEDS_IMPROVEMENT")
    assert router.call_count == 7


def test_pipeline_section_order():
    router = FullMockRouter()
    pipeline = PipelineRunner(router)
    result = pipeline.run(SAMPLE_CHANNEL, "test")
    section_types = [s["section_type"] for s in result["sections"]]
    assert section_types == ["idea", "script", "scene_plan", "music", "titles", "thumbnail", "qa_report"]


def test_pipeline_skip_sections():
    router = FullMockRouter()
    pipeline = PipelineRunner(router)
    result = pipeline.run(SAMPLE_CHANNEL, "test", skip_sections={"idea", "script", "visual"})
    section_types = [s["section_type"] for s in result["sections"]]
    assert "idea" not in section_types
    assert "script" not in section_types
    assert "scene_plan" not in section_types
    assert "music" in section_types
    assert router.call_count <= 4


def test_pipeline_growth_score_extraction():
    router = FullMockRouter()
    pipeline = PipelineRunner(router)
    result = pipeline.run(SAMPLE_CHANNEL, "test")
    scores = result["approval"]["scores"]
    assert scores.get("growth_score") == 88
    assert "idea_topic_demand" in scores or any(k.startswith("idea_") for k in scores)


def test_pipeline_script_score_extraction():
    router = FullMockRouter()
    pipeline = PipelineRunner(router)
    result = pipeline.run(SAMPLE_CHANNEL, "test")
    scores = result["approval"]["scores"]
    assert scores.get("script_score") == 85
    assert scores.get("retention") == 82
    assert scores.get("monetization") == 90


def test_pipeline_title_score_extraction():
    router = FullMockRouter()
    pipeline = PipelineRunner(router)
    result = pipeline.run(SAMPLE_CHANNEL, "test")
    scores = result["approval"]["scores"]
    assert scores.get("title_score") == 85


def test_pipeline_thumbnail_score_extraction():
    router = FullMockRouter()
    pipeline = PipelineRunner(router)
    result = pipeline.run(SAMPLE_CHANNEL, "test")
    scores = result["approval"]["scores"]
    assert scores.get("thumbnail_score") == 90


def test_pipeline_music_score_extraction():
    router = FullMockRouter()
    pipeline = PipelineRunner(router)
    result = pipeline.run(SAMPLE_CHANNEL, "test")
    scores = result["approval"]["scores"]
    assert scores.get("music_score") == 85


def test_pipeline_qa_score_extraction():
    router = FullMockRouter()
    pipeline = PipelineRunner(router)
    result = pipeline.run(SAMPLE_CHANNEL, "test")
    scores = result["approval"]["scores"]
    assert scores.get("copyright_safety") == 95
    assert scores.get("monetization_safety") == 90
    assert scores.get("factual_accuracy") == 88
    assert scores.get("qa_overall", 0) > 0


def test_pipeline_approval_failing():
    class LowScoreRouter(FullMockRouter):
        def generate(self, prompt, system_prompt="", temperature=0.7, max_tokens=4096, **kwargs):
            self.call_count += 1
            responses = [
                json.dumps({"ideas": [{"topic": "test", "score": {"total": 70}}]}),
                json.dumps({"script": "test", "score": {"script_quality": {"score": 70}, "retention": {"score": 70}, "monetization": {"score": 70}, "factual_accuracy": {"score": 70}}}),
                json.dumps({"scenes": []}),
                json.dumps({"genre": "ambient", "score": {"music_fit": {"score": 70}}}),
                json.dumps({"titles": [], "title_score": {"score": 70}}),
                json.dumps({"thumbnail_concepts": [], "score": {"thumbnail_quality": {"score": 70}}}),
                json.dumps({"checks": [{"type": "copyright", "score": 70}, {"type": "monetization", "score": 70}]}),
            ]
            return responses[min(self.call_count - 1, len(responses) - 1)]

    router = LowScoreRouter()
    pipeline = PipelineRunner(router)
    result = pipeline.run(SAMPLE_CHANNEL, "low quality topic")
    assert result["approval"]["status"] == "NEEDS_IMPROVEMENT"
    assert len(result["approval"]["failing"]) > 0


def test_pipeline_approval_all_passing():
    class HighScoreRouter(FullMockRouter):
        def generate(self, prompt, system_prompt="", temperature=0.7, max_tokens=4096, **kwargs):
            self.call_count += 1
            responses = [
                json.dumps({"ideas": [{"topic": "test", "score": {"total": 95}}]}),
                json.dumps({"script": "test", "score": {"script_quality": {"score": 95}, "retention": {"score": 95}, "monetization": {"score": 95}, "factual_accuracy": {"score": 95}}}),
                json.dumps({"scenes": []}),
                json.dumps({"genre": "ambient", "score": {"music_fit": {"score": 95}}}),
                json.dumps({"titles": [], "title_score": {"score": 95}}),
                json.dumps({"thumbnail_concepts": [], "score": {"thumbnail_quality": {"score": 95}}}),
                json.dumps({"checks": [{"type": "copyright", "score": 95}, {"type": "monetization", "score": 95}]}),
            ]
            return responses[min(self.call_count - 1, len(responses) - 1)]

    router = HighScoreRouter()
    pipeline = PipelineRunner(router)
    result = pipeline.run(SAMPLE_CHANNEL, "excellent topic")
    assert result["approval"]["status"] == "APPROVED"
    assert len(result["approval"]["failing"]) == 0


def test_pipeline_on_progress_callback():
    events = []

    def capture(event):
        events.append(event)

    router = FullMockRouter()
    pipeline = PipelineRunner(router)
    result = pipeline.run(SAMPLE_CHANNEL, "test", on_progress=capture)
    agent_events = [e for e in events if e["status"] == "done"]
    assert len(agent_events) == 7
    assert agent_events[0]["agent"] == "idea"
    assert agent_events[-1]["agent"] == "qa"


def test_pipeline_on_progress_with_skip():
    events = []

    def capture(event):
        events.append(event)

    router = FullMockRouter()
    pipeline = PipelineRunner(router)
    pipeline.run(SAMPLE_CHANNEL, "test", skip_sections={"idea", "script"}, on_progress=capture)
    skipped = [e for e in events if e["status"] == "skipped"]
    assert len(skipped) == 2


def test_pipeline_flatten_output():
    from core.pipeline import PipelineRunner
    pipeline = PipelineRunner()

    flat = pipeline._flatten_output({"ideas": [{"topic": "AI"}]}, "idea")
    assert "idea" in flat
    assert "ideas_json" in flat

    flat = pipeline._flatten_output({"script": "Hello world"}, "script")
    assert flat["script"] == "Hello world"

    flat = pipeline._flatten_output({"scenes": [{"scene": 1}]}, "visual")
    assert "scene_plan" in flat

    flat = pipeline._flatten_output({"titles": [{"title": "Test"}], "recommended_title": "Test"}, "title")
    assert "titles" in flat
    assert flat["title"] == "Test"

    flat = pipeline._flatten_output({"checks": [{"type": "copyright", "score": 95}]}, "qa")
    assert flat["qa_report"] is not None
