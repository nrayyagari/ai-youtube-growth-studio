import json
import pytest

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
    def __init__(self, response="{}"):
        if isinstance(response, str):
            self._response = response
        else:
            self._response = json.dumps(response)

    def generate(self, prompt, temperature=0.7, max_tokens=4096, format=None):
        return self._response


def sample_idea_response():
    return {
        "ideas": [
            {
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
            }
        ]
    }
