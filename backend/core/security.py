"""安全工具"""

import hashlib
import hmac
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import Header, HTTPException

from config.constants import AUTH_TOKEN_TTL_SECONDS
from core.redis_client import redis_client, make_auth_key, make_user_key


def normalize_email(email: str) -> str:
    """标准化邮箱地址"""
    return (email or "").strip().lower()


def hash_password(password: str) -> str:
    """密码哈希"""
    return hashlib.sha256((password or "").encode("utf-8")).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    """验证密码"""
    return hmac.compare_digest(hash_password(password), password_hash or "")


def generate_token() -> str:
    """生成认证 Token"""
    return str(uuid.uuid4())


def now_iso() -> str:
    """获取当前 ISO 格式时间"""
    return datetime.now(timezone.utc).isoformat()


def parse_bearer_token(authorization: str) -> str:
    """从 Authorization 头解析 Bearer Token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="缺少 Authorization")
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        raise HTTPException(status_code=401, detail="Authorization 格式错误")
    token = authorization[len(prefix):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="token 为空")
    return token


def get_current_user_from_auth_header(authorization: str) -> Dict[str, Any]:
    """从认证头获取当前用户"""
    token = parse_bearer_token(authorization)
    auth_key = make_auth_key(token)
    user_email = redis_client.get(auth_key)
    
    if not user_email:
        raise HTTPException(status_code=401, detail="登录态已失效，请重新登录")
    
    import json
    user_raw = redis_client.get(make_user_key(user_email))
    if not user_raw:
        raise HTTPException(status_code=401, detail="用户不存在")
    
    user_data = json.loads(user_raw)
    # 刷新 Token 有效期
    redis_client.expire(auth_key, AUTH_TOKEN_TTL_SECONDS)
    
    return {
        "email": user_data.get("email", ""),
        "name": user_data.get("name", ""),
        "avatar_url": user_data.get("avatar_url", ""),
        "created_at": user_data.get("created_at", ""),
        "target_role": user_data.get("target_role", ""),
        "work_experience_years": user_data.get("work_experience_years", 0),
        "desired_city": user_data.get("desired_city", ""),
        "expected_salary": user_data.get("expected_salary", ""),
        "skills": user_data.get("skills", []),
        "bio": user_data.get("bio", ""),
        "token": token
    }


def get_current_user_optional(authorization: str = Header(None)) -> Optional[Dict[str, Any]]:
    """可选获取当前用户（不抛出异常）"""
    try:
        return get_current_user_from_auth_header(authorization)
    except HTTPException:
        return None
