"""通知业务服务"""

import json
import uuid
from typing import Any, Dict, List

from core.redis_client import redis_client, make_notifications_key
from core.security import now_iso
from config.constants import MAX_NOTIFICATIONS


class NotificationService:
    """通知服务类"""
    
    def push_notification(
        self,
        target_email: str,
        notif_type: str,
        title: str,
        body: str,
        link: str = "",
        actor_name: str = ""
    ):
        """推送通知到用户队列"""
        if not target_email:
            return
        
        notif = {
            "id": str(uuid.uuid4()),
            "type": notif_type,
            "title": title,
            "body": body,
            "link": link,
            "actor_name": actor_name,
            "is_read": False,
            "created_at": now_iso()
        }
        
        key = make_notifications_key(target_email)
        redis_client.lpush(key, json.dumps(notif, ensure_ascii=False))
        # 保留最新 100 条
        redis_client.ltrim(key, 0, MAX_NOTIFICATIONS - 1)
    
    def get_notifications(self, user_email: str) -> List[Dict[str, Any]]:
        """获取用户通知列表"""
        key = make_notifications_key(user_email)
        raw = redis_client.lrange(key, 0, 49)
        notifs = []
        for item in raw:
            try:
                notifs.append(json.loads(item))
            except Exception:
                pass
        return notifs
    
    def mark_as_read(self, user_email: str, notif_id: str) -> bool:
        """标记单条通知为已读"""
        key = make_notifications_key(user_email)
        raw = redis_client.lrange(key, 0, 99)
        
        for i, item in enumerate(raw):
            try:
                n = json.loads(item)
                if n.get("id") == notif_id:
                    n["is_read"] = True
                    redis_client.lset(key, i, json.dumps(n, ensure_ascii=False))
                    return True
            except Exception:
                continue
        return False
    
    def mark_all_as_read(self, user_email: str) -> bool:
        """标记所有通知为已读"""
        key = make_notifications_key(user_email)
        raw = redis_client.lrange(key, 0, 99)
        
        for i, item in enumerate(raw):
            try:
                n = json.loads(item)
                if not n.get("is_read"):
                    n["is_read"] = True
                    redis_client.lset(key, i, json.dumps(n, ensure_ascii=False))
            except Exception:
                continue
        return True


# 全局通知服务实例
notification_service = NotificationService()
