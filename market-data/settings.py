"""市场库专用配置（与 plm-backend 无关，仅读本目录 .env）。"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # 与 PLM 分库：默认「市场洞察库」；沿用旧数据时在 .env 改为「市场数据库」
    MONGO_URI: str = "mongodb://192.168.91.87:27017"
    MONGO_DB_NAME: str = "市场洞察库"


def get_settings() -> Settings:
    return Settings()
