"""面经广场相关路由"""

from typing import Optional
from fastapi import APIRouter, Header, Query

from models.schemas import PostCreateRequest, CommentCreateRequest
from services.post_service import post_service
from core.security import get_current_user_from_auth_header, get_current_user_optional

router = APIRouter(prefix="/api", tags=["面经广场"])


# ========== 帖子相关 ==========

@router.post("/posts")
async def create_post(
    request: PostCreateRequest,
    authorization: str = Header(None)
):
    """创建帖子"""
    user = get_current_user_from_auth_header(authorization)
    post = post_service.create_post(
        company=request.company,
        role=request.role,
        content=request.content,
        tags=request.tags,
        user=user
    )
    return {"code": 200, "data": post}


@router.get("/posts")
async def list_posts(
    q: str = Query("", description="搜索关键词"),
    limit: int = Query(100, description="返回数量限制")
):
    """获取帖子列表"""
    posts = post_service.list_posts(query=q, limit=limit)
    return {"code": 200, "data": posts}


@router.get("/posts/{post_id}")
async def get_post(post_id: str):
    """获取帖子详情"""
    post = post_service.get_post(post_id)
    return {"code": 200, "data": post}


@router.delete("/posts/{post_id}")
async def delete_post(post_id: str, authorization: str = Header(None)):
    """删除帖子"""
    user = get_current_user_from_auth_header(authorization)
    post_service.delete_post(post_id, user["email"])
    return {"code": 200, "data": True}


@router.post("/posts/{post_id}/like")
async def toggle_post_like(post_id: str, authorization: str = Header(None)):
    """点赞/取消点赞帖子"""
    user = get_current_user_from_auth_header(authorization)
    result = post_service.toggle_like(post_id, user["email"])
    return {"code": 200, "data": result}


@router.get("/posts/{post_id}/like-status")
async def get_like_status(
    post_id: str,
    authorization: str = Header(None)
):
    """获取帖子点赞状态"""
    try:
        user = get_current_user_from_auth_header(authorization)
        is_liked = post_service.get_like_status(post_id, user["email"])
        return {"code": 200, "data": {"is_liked": is_liked}}
    except Exception:
        return {"code": 200, "data": {"is_liked": False}}


# ========== 评论相关 ==========

@router.post("/posts/{post_id}/comments")
async def create_comment(
    post_id: str,
    request: CommentCreateRequest,
    authorization: str = Header(None)
):
    """创建评论"""
    user = get_current_user_from_auth_header(authorization)
    comment = post_service.create_comment(
        post_id=post_id,
        content=request.content,
        reply_to=request.reply_to,
        reply_to_name=request.reply_to_name,
        user=user
    )
    return {"code": 200, "data": comment}


@router.get("/posts/{post_id}/comments")
async def list_comments(post_id: str):
    """获取评论列表"""
    comments = post_service.list_comments(post_id)
    return {"code": 200, "data": comments}


@router.delete("/posts/{post_id}/comments/{comment_id}")
async def delete_comment(
    post_id: str,
    comment_id: str,
    authorization: str = Header(None)
):
    """删除评论"""
    user = get_current_user_from_auth_header(authorization)
    post_service.delete_comment(post_id, comment_id, user["email"])
    return {"code": 200, "data": True}


@router.post("/posts/{post_id}/comments/{comment_id}/like")
async def toggle_comment_like(
    post_id: str,
    comment_id: str,
    authorization: str = Header(None)
):
    """点赞/取消点赞评论"""
    user = get_current_user_from_auth_header(authorization)
    result = post_service.toggle_comment_like(comment_id, user["email"])
    return {"code": 200, "data": result}


@router.get("/posts/{post_id}/comments/{comment_id}/like-status")
async def get_comment_like_status(
    post_id: str,
    comment_id: str,
    authorization: str = Header(None)
):
    """获取评论点赞状态"""
    try:
        user = get_current_user_from_auth_header(authorization)
        result = post_service.get_comment_like_status(comment_id, user["email"])
        return {"code": 200, "data": result}
    except Exception:
        return {"code": 200, "data": {"is_liked": False, "likes_count": 0}}
