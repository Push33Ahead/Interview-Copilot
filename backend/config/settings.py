"""应用配置"""

import os
from pathlib import Path
from typing import List


class Settings:
    """应用配置类"""
    
    # 上传目录
    UPLOAD_BASE_DIR = Path(os.getenv("UPLOAD_BASE_DIR", "uploads"))
    AVATAR_DIR = UPLOAD_BASE_DIR / "avatars"
    
    # Redis 配置
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB = int(os.getenv("REDIS_DB", "0"))
    
    # AI API 配置
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "sk-ctwyk9nnodkhkuwdolwlzt2oyot92xyp9u0jdrpo84et26he")
    OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.xiaomimimo.com/v1")
    
    # SMTP 配置
    SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
    SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
    SMTP_USER = os.getenv("SMTP_USER", "").strip()
    SMTP_PASS = os.getenv("SMTP_PASS", "").strip()
    SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER).strip()
    SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "true").lower() in ("1", "true", "yes")
    
    @classmethod
    def init_directories(cls):
        """初始化必要的目录"""
        cls.AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    
    @classmethod
    def parse_cors_origins(cls) -> List[str]:
        """解析 CORS 来源"""
        raw = os.getenv("CORS_ORIGINS", "").strip()
        if raw:
            origins = [x.strip() for x in raw.split(",") if x.strip()]
            if origins:
                return origins
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000"
        ]


# 全局配置实例
settings = Settings()
