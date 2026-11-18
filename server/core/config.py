from pathlib import Path
from pydantic_settings import BaseSettings

SERVER_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    DATABASE_URL: str = f"sqlite:///{SERVER_DIR / 'db.sqlite'}"
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    # Passwords for the default accounts created on first run (set in server/.env)
    SEED_ADMIN_PASSWORD: str = ""
    SEED_USER_PASSWORD: str = ""

    class Config:
        env_file = SERVER_DIR / ".env"
        extra = "ignore"

settings = Settings()