from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # AI Provider Keys (users can also bring their own)
    gemini_api_key: str = ""
    grok_api_key: str = ""
    cerebras_api_key: str = ""
    deepseek_api_key: str = ""
    openai_api_key: str = ""

    # App config
    database_url: str = "sqlite:///./data/growth_studio.db"
    frontend_origin: str = "http://localhost:5173"
    app_base_url: str = "http://localhost:5173"
    jwt_secret: str = "change-me-in-production"
    dev_mode: bool = True

    # OTP / Email
    otp_expiry_seconds: int = 300
    email_from: str = "noreply@growthstudio.app"
    resend_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""

    # YouTube OAuth
    youtube_client_id: str = ""
    youtube_client_secret: str = ""
    youtube_redirect_uri: str = "http://localhost:8000/api/youtube/oauth/callback"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
