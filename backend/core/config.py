from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./data/growth_studio.db"
    gemini_api_key: str = ""
    grok_api_key: str = ""
    cerebras_api_key: str = ""
    frontend_origin: str = "http://localhost:5173"
    youtube_client_id: str = ""
    youtube_client_secret: str = ""
    youtube_redirect_uri: str = "http://localhost:8000/api/youtube/oauth/callback"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
