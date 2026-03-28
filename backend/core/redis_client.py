"""Redis 客户端"""

import redis
from config.settings import settings

# 全局 Redis 客户端
redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB,
    decode_responses=True
)


def make_user_key(email: str) -> str:
    return f"user:{email.lower().strip()}"


def make_auth_key(token: str) -> str:
    return f"auth:{token}"


def make_register_code_key(email: str) -> str:
    return f"register_code:{email.lower().strip()}"


def make_register_cooldown_key(email: str) -> str:
    return f"register_cooldown:{email.lower().strip()}"


def make_user_reports_key(email: str) -> str:
    return f"user_reports:{email.lower().strip()}"


def make_report_detail_key(report_id: str) -> str:
    return f"report:{report_id}"


def make_session_key(session_id: str) -> str:
    return f"session:{session_id}"


def make_post_key(post_id: str) -> str:
    return f"post_detail:{post_id}"


def make_post_likes_key(post_id: str) -> str:
    return f"post_likes:{post_id}"


def make_post_comments_key(post_id: str) -> str:
    return f"post_comments:{post_id}"


def make_comment_likes_key(comment_id: str) -> str:
    return f"comment_likes:{comment_id}"


def make_notifications_key(email: str) -> str:
    return f"notifications:{email.lower().strip()}"
