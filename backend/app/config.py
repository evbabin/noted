from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
    )

    # App
    APP_NAME: str = "Noted API"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://noted:noted@localhost:5432/noted"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    # AI (provider-agnostic: supports openai, gemini, groq, openrouter, mock)
    AI_PROVIDER: str = "openai"  # "openai" | "gemini" | "groq" | "openrouter" | "mock"
    AI_MODEL: str = "gpt-4o-mini"  # Model name for the chosen provider
    OPENAI_API_KEY: str = ""  # Required if AI_PROVIDER=openai
    GEMINI_API_KEY: str = ""  # Required if AI_PROVIDER=gemini
    GROQ_API_KEY: str = ""  # Required if AI_PROVIDER=groq
    OPENROUTER_API_KEY: str = ""  # Required if AI_PROVIDER=openrouter

    # Rate Limiting
    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_AI: str = "5/minute"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
