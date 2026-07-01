from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    GOOGLE_TTS_API_KEY: str = ""
    DATABASE_URL: str = "postgresql://postgres:postgres@127.0.0.1:5432/healthtwin"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
