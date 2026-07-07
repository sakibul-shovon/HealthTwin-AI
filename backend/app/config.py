from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    # Optional: force a specific Groq model for the brain (tried before the fallback chain).
    GROQ_BRAIN_MODEL: str = ""
    DATABASE_URL: str = "postgresql://postgres:postgres@127.0.0.1:5433/healthtwin"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    # Pattern Agent: dengue-season demo flag + symptom-cluster rolling window
    DENGUE_SEASON: bool = True
    CLUSTER_WINDOW_HOURS: int = 48
    # Triage Agent: local emergency number (Bangladesh national emergency = 999)
    EMERGENCY_NUMBER: str = "999"
    NEAREST_HOSPITAL: str = "https://maps.google.com/?q=hospital"
    JWT_SECRET: str = "change-me-in-production-healthtwin-secret-2024"
    DEBUG: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
