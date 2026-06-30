from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://kinpoyo:kinpoyo@localhost:5432/kinpoyo"

    model_config = {"env_file": ".env"}


settings = Settings()
