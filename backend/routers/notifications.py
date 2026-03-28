"""通知相关路由"""

from fastapi import APIRouter, Header

from services.notification_service import notification_service
from core.security import get_current_user_from_auth_header

router = APIRouter(prefix="/api", tags=["通知"])


@router.get("/notifications")
async def get_notifications(authorization: str = Header(None)):
    """获取通知列表"""
    user = get_current_user_from_auth_header(authorization)
    notifs = notification_service.get_notifications(user["email"])
    return {"code": 200, "data": notifs}


@router.post("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, authorization: str = Header(None)):
    """标记单条通知为已读"""
    user = get_current_user_from_auth_header(authorization)
    notification_service.mark_as_read(user["email"], notif_id)
    return {"code": 200, "data": True}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(authorization: str = Header(None)):
    """标记所有通知为已读"""
    user = get_current_user_from_auth_header(authorization)
    notification_service.mark_all_as_read(user["email"])
    return {"code": 200, "data": True}
