import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.config import Settings


def test_settings_defaults():
    s = Settings()
    assert s.database_url == "sqlite:///./data/growth_studio.db"
    assert s.gemini_api_key == ""
    assert s.grok_api_key == ""
    assert s.cerebras_api_key == ""
    assert s.frontend_origin == "http://localhost:5173"


def test_settings_env_file_config():
    assert hasattr(Settings, "model_config")
    config = Settings.model_config
    assert "env_file" in config
    assert config["env_file"] == ".env"


def test_settings_youtube_config():
    s = Settings()
    assert s.youtube_client_id == ""
    assert s.youtube_client_secret == ""
    assert s.youtube_redirect_uri == "http://localhost:8000/api/youtube/oauth/callback"
