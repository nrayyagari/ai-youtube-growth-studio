import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from core.router import AIProviderRouter, AllProvidersExhausted, RateTracker

from tests.conftest import sample_idea_response


def test_rate_tracker_can_call():
    tracker = RateTracker(window_seconds=60)
    assert tracker.can_call("gemini", 15) is True


def test_rate_tracker_hits_limit():
    tracker = RateTracker(window_seconds=600)
    for _ in range(5):
        tracker.record("gemini")
    assert tracker.can_call("gemini", 5) is False


def test_rate_tracker_different_providers():
    tracker = RateTracker()
    for _ in range(5):
        tracker.record("gemini")
    assert tracker.can_call("groq", 30) is True


def test_rate_tracker_window_expires():
    tracker = RateTracker(window_seconds=1)
    for _ in range(5):
        tracker.record("gemini")
    time.sleep(1.1)
    assert tracker.can_call("gemini", 5) is True


def test_router_provider_config():
    router = AIProviderRouter()
    assert "gemini" in router.PROVIDERS
    assert "groq" in router.PROVIDERS
    assert "cerebras" in router.PROVIDERS
    assert router.PROVIDERS["gemini"]["model"] == "gemini-2.0-flash"


def test_router_all_exhausted_without_keys():
    from core.database import init_db, get_db
    init_db()
    router = AIProviderRouter()
    with pytest.raises(AllProvidersExhausted):
        router.generate("test prompt")
