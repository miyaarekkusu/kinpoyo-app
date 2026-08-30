from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://kinpoyo:kinpoyo@localhost:5432/kinpoyo"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    # AIレビュー機能（DeepSeek API）。未設定でもアプリ起動は失敗させず、
    # 実際にレビュー生成を呼んだ時だけエラーにする（app/core/deepseek_client.py）。
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_API: str | None = None

    model_config = {"env_file": ".env"}


settings = Settings()
