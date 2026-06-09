import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests.conftest import SAMPLE_CHANNEL, MockRouter
from agents.master_router_agent import MasterRouterAgent
from agents.reference_intelligence_agent import ReferenceIntelligenceAgent
from agents.ab_test_agent import ABTestAgent
from agents.tts_agent import TTSAgent
from agents.whisper_agent import WhisperAgent
from agents.thumbnail_generator import ThumbnailGeneratorAgent
from agents.repurpose_agent import RepurposeAgent


def test_master_router_analyze_reference():
    agent = MasterRouterAgent()
    router = MockRouter({"visual_style": "Clean", "tone": "Educational"})
    result = agent.analyze_reference(SAMPLE_CHANNEL, [{"title": "Test Video", "transcript": "Hello"}], router)
    assert "visual_style" in result

def test_reference_intelligence_detect_trends():
    agent = ReferenceIntelligenceAgent()
    router = MockRouter({"trends": [{"topic": "AI breakthroughs", "estimated_ctr": 90}]})
    result = agent.process(SAMPLE_CHANNEL, {"action": "detect_trends"}, router)
    assert result["section_type"] == "trending_topics"

def test_reference_intelligence_analyze_patterns():
    agent = ReferenceIntelligenceAgent()
    router = MockRouter({"detected_patterns": [{"pattern_name": "Hook + Reveal", "effectiveness_score": 85}]})
    result = agent.process(SAMPLE_CHANNEL, {"action": "analyze_patterns", "reference_videos": [], "competitor_findings": [], "existing_patterns": []}, router)
    assert result["section_type"] == "pattern_analysis"

def test_ab_test_generate_variants():
    agent = ABTestAgent()
    router = MockRouter({"titles": [{"variant": "A", "title": "Test", "predicted_ctr": 85}], "thumbnails": [{"variant": "A", "concept": "Test", "predicted_ctr": 80}], "recommended_combination": {"title_variant": "A", "combined_ctr_prediction": 88}})
    result = agent.process(SAMPLE_CHANNEL, {"action": "generate_variants", "topic": "AI", "script": "test"}, router)
    assert "titles" in result["output"]

def test_ab_test_score_variants():
    agent = ABTestAgent()
    router = MockRouter({"results": [{"variant": "A", "outcome": "won", "actual_ctr": 8.5}], "winner": {"title_variant": "A"}, "next_test_recommendation": "Test B"})
    result = agent.process(SAMPLE_CHANNEL, {"action": "score_variants", "titles": [], "thumbnails": [], "performance_data": {}}, router)
    assert "results" in result["output"]

def test_tts_agent_list_voices():
    agent = TTSAgent()
    result = agent.process(SAMPLE_CHANNEL, {"action": "list_voices"}, None)
    assert result["section_type"] in ("tts_voices", "tts_narration")

def test_tts_agent_no_script():
    agent = TTSAgent()
    result = agent.process(SAMPLE_CHANNEL, {"action": "generate_narration", "script": ""}, None)
    assert "error" in result["output"]

def test_whisper_agent_check_availability():
    agent = WhisperAgent()
    result = agent.process(SAMPLE_CHANNEL, {"action": "check_available"}, None)
    assert result["section_type"] == "whisper_check"

def test_whisper_agent_no_input():
    agent = WhisperAgent()
    result = agent.process(SAMPLE_CHANNEL, {}, None)
    assert "error" in result["output"]

def test_thumbnail_generator_no_concept():
    agent = ThumbnailGeneratorAgent()
    result = agent.process(SAMPLE_CHANNEL, {"action": "generate"}, None)
    assert "error" in result["output"]

def test_repurpose_agent_no_script():
    agent = RepurposeAgent()
    result = agent.process(SAMPLE_CHANNEL, {"script": ""}, None)
    assert "error" in result["output"]

def test_repurpose_agent_with_script():
    agent = RepurposeAgent()
    router = MockRouter({"shorts": [{"hook": "Did you know?", "script": "AI is changing everything...", "title": "AI Revolution", "viral_potential": 85, "thumb_concept": {}}], "repurposing_insight": "AI topics work great"})
    result = agent.process(SAMPLE_CHANNEL, {"script": "Long script about AI...", "topic": "AI"}, router)
    assert "shorts" in result["output"]
    assert len(result["output"]["shorts"]) > 0
