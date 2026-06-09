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
    clerk_webhook_secret: str = ""
    clerk_publishable_key: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_price_id: str = ""
    stripe_agency_price_id: str = ""
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    razorpay_pro_plan_id: str = ""
    razorpay_agency_plan_id: str = ""
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_webhook_id: str = ""
    paypal_pro_plan_id: str = ""
    paypal_agency_plan_id: str = ""
    app_base_url: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
