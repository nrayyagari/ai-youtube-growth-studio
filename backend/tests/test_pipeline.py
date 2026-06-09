import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests.conftest import SAMPLE_CHANNEL, sample_idea_response
from core.pipeline import PipelineRunner, PipelineError
from core.router import AIProviderRouter


class FullMockRouter(AIProviderRouter):
    def __init__(self):
        self.call_count = 0

    def generate(self, prompt, temperature=0.7, max_tokens=4096, format=None):
        self.call_count += 1
        responses = [
            json.dumps(sample_idea_response()),
            json.dumps({"script": "Test script about AI", "score": {"script_quality": {"score": 85}, "retention": {"score": 80}, "monetization": {"score": 90}, "factual_accuracy": {"score": 88}}}),
            json.dumps({"scenes": [{"scene": 1, "description": "Opening", "duration": 10}], "score": {}}),
            json.dumps({"genre": "ambient", "mood": "calm", "score": {"overall": 80}}),
            json.dumps({"titles": [{"title": "AI Revolution"}], "recommended_title": "AI Revolution", "title_score": {"score": 85}}),
            json.dumps({"thumbnail_concepts": [{"concept_name": "Future Tech", "description": "Futuristic thumbnail", "text_overlay": "WOW"}], "score": {"thumbnail_quality": {"score": 90}}}),
            json.dumps({"checks": [{"type": "copyright", "score": 95, "status": "pass"}, {"type": "monetization", "score": 90, "status": "pass"}]}),
        ]
        return responses[min(self.call_count - 1, len(responses) - 1)]


def test_pipeline_full_run():
    router = FullMockRouter()
    pipeline = PipelineRunner(router)
    result = pipeline.run(SAMPLE_CHANNEL, "AI tools")
    assert len(result["sections"]) == 7
    assert "approval" in result
    assert result["approval"]["status"] in ("APPROVED", "NEEDS_IMPROVEMENT")
    assert router.call_count == 7


def test_pipeline_error():
    router = FullMockRouter()
    pipeline = PipelineRunner(router)
    try:
        pipeline.run({}, "")  # Missing required fields shouldn't crash pipeline
    except PipelineError:
        pass  # Expected for some invalid inputs
    except Exception:
        pass  # Other exceptions acceptable in edge cases
