import json
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

SAMPLE_CHANNEL = {
    "id": 1,
    "name": "CurioLab",
    "niche": "General Knowledge",
    "audience": "18-35 curious minds",
    "language": "en",
    "monetization_goal": "Ad revenue",
    "content_mode": "single_video",
}


class MockRouter:
    min_interval = 0.0

    def __init__(self, response="{}"):
        if isinstance(response, str):
            self._response = response
        else:
            self._response = json.dumps(response)

    def generate(self, prompt, system_prompt="", temperature=0.7, max_tokens=4096, **kwargs):
        return self._response


class FullMockRouter:
    min_interval = 0.0
    def __init__(self):
        self.call_count = 0

    def generate(self, prompt, system_prompt="", temperature=0.7, max_tokens=4096, **kwargs):
        self.call_count += 1
        responses = [
            json.dumps(sample_idea_response()),
            json.dumps(sample_script_response()),
            json.dumps(sample_visual_response()),
            json.dumps(sample_music_response()),
            json.dumps(sample_title_response()),
            json.dumps(sample_thumbnail_response()),
            json.dumps(sample_qa_response()),
        ]
        return responses[min(self.call_count - 1, len(responses) - 1)]


def sample_idea_response():
    return {
        "ideas": [{
            "title": "How AI Is Changing Office Jobs in 2026",
            "topic": "AI workplace transformation",
            "angle": "Surprising ways AI automates white-collar work",
            "audience_relevance": "Professionals concerned about job security",
            "score": {
                "total": 88,
                "topic_demand": {"score": 90, "explanation": "Trending topic"},
                "pain_point": {"score": 85, "explanation": "Universal concern"},
                "ctr": {"score": 88, "explanation": "Strong hook potential"},
                "retention": {"score": 82, "explanation": "Good pacing possible"},
                "monetization": {"score": 90, "explanation": "Advertiser friendly"},
                "competition": {"score": 75, "explanation": "Moderate competition"},
                "series": {"score": 85, "explanation": "Series potential"},
                "channel_fit": {"score": 88, "explanation": "Perfect fit"},
            },
        }]
    }


def sample_script_response():
    return {
        "script": "Here's how AI is transforming workplaces...",
        "hook": "Did you know AI will replace 300M jobs?",
        "tone": "educational",
        "score": {
            "script_quality": {"score": 85, "explanation": "Good structure"},
            "retention": {"score": 82, "explanation": "Decent"},
            "monetization": {"score": 90, "explanation": "Ad-safe"},
            "factual_accuracy": {"score": 88, "explanation": "Accurate"},
        },
    }


def sample_visual_response():
    return {
        "scenes": [
            {"scene_number": 1, "description": "Opening hook with bold text", "duration": 15},
            {"scene_number": 2, "description": "AI stats overlay", "duration": 20},
        ]
    }


def sample_music_response():
    return {
        "music_suggestions": [
            {"scene_range": "scenes 1-3", "mood": "upbeat", "genre": "electronic", "source": "YouTube Audio Library"}
        ],
        "overall_music_direction": "Modern electronic with build-ups",
        "score": {"music_fit": {"score": 85, "explanation": "Good match"}},
    }


def sample_title_response():
    return {
        "titles": [
            {"title": "AI Replaced My Job - Here's Why", "predicted_ctr": 8.5},
            {"title": "The AI Takeover Has Begun", "predicted_ctr": 7.2},
        ],
        "recommended_title": "AI Replaced My Job - Here's Why",
        "title_score": {"score": 85, "explanation": "Strong CTR potential"},
        "seo": {"tags": ["AI", "future of work", "technology"]},
    }


def sample_thumbnail_response():
    return {
        "thumbnail_concepts": [
            {"concept_name": "Shock Factor", "description": "Person looking shocked at computer", "color_scheme": "High contrast red/black", "text_overlay": "GONE"},
        ],
        "score": {"thumbnail_quality": {"score": 90, "explanation": "Eye-catching"}},
    }


def sample_qa_response():
    return {
        "checks": [
            {"type": "copyright", "score": 95, "status": "PASS", "details": "No copyright issues", "issues": []},
            {"type": "monetization", "score": 90, "status": "PASS", "details": "Advertiser friendly", "issues": []},
            {"type": "factual", "score": 88, "status": "PASS", "details": "Accurate", "issues": []},
            {"type": "script_quality", "score": 85, "status": "PASS", "details": "Well-structured", "issues": []},
            {"type": "visual_consistency", "score": 82, "status": "WARN", "details": "Minor gaps", "issues": []},
        ],
        "overall_qa_score": 88,
        "is_safe_to_publish": True,
    }
