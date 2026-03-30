"""面经广场业务服务"""

import json
import uuid
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from core.redis_client import (
    redis_client, make_post_key, make_post_likes_key,
    make_post_comments_key, make_comment_likes_key
)
from core.security import now_iso
from services.notification_service import notification_service


class PostService:
    """帖子服务类"""
    
    def create_post(
        self,
        company: str,
        role: str,
        content: str,
        tags: List[str],
        user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """创建帖子"""
        post_id = str(uuid.uuid4())
        now = now_iso()
        
        post_data = {
            "id": post_id,
            "author_email": user["email"],
            "author_name": user.get("name") or "匿名用户",
            "author_avatar": user.get("avatar_url", ""),
            "company": company.strip(),
            "role": role.strip(),
            "content": content.strip(),
            "tags": [t.strip() for t in tags if t.strip()],
            "created_at": now,
            "views_count": 0,
            "likes_count": 0,
            "comments_count": 0
        }
        
        redis_client.set(
            make_post_key(post_id),
            json.dumps(post_data, ensure_ascii=False)
        )
        redis_client.lpush("global:post_ids", post_id)
        
        return post_data
    
    def list_posts(self, query: str = "", limit: int = 100) -> List[Dict[str, Any]]:
        """获取帖子列表"""
        ids = redis_client.lrange("global:post_ids", 0, limit * 2)
        posts = []
        
        if not ids:
            return posts
        
        # 去重
        ids_set = list(dict.fromkeys(ids))
        
        for pid in ids_set:
            val = redis_client.get(make_post_key(pid))
            if val:
                try:
                    posts.append(json.loads(val))
                except Exception:
                    pass
        
        # 搜索过滤
        if query:
            q_lower = query.lower()
            posts = [p for p in posts if (
                q_lower in p.get("company", "").lower() or
                q_lower in p.get("role", "").lower() or
                q_lower in p.get("content", "").lower() or
                any(q_lower in tag.lower() for tag in p.get("tags", []))
            )]
        
        # 按时间排序
        posts.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        # 生成摘要
        for p in posts:
            if len(p["content"]) > 300:
                p["content_snippet"] = p["content"][:300] + "..."
            else:
                p["content_snippet"] = p["content"]
        
        return posts[:limit]
    
    def search_posts(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """搜索相关帖子（用于面试场景）
        
        与 list_posts 的区别：
        1. 不生成摘要，返回完整内容
        2. 更宽松的匹配策略
        3. 按匹配度排序（而非时间）
        """
        if not query or not query.strip():
            return []
        
        # 获取所有帖子 ID（放宽数量限制）
        ids = redis_client.lrange("global:post_ids", 0, 500)
        if not ids:
            return []
        
        # 去重
        ids_set = list(dict.fromkeys(ids))
        
        # 获取所有帖子
        all_posts = []
        for pid in ids_set:
            val = redis_client.get(make_post_key(pid))
            if val:
                try:
                    all_posts.append(json.loads(val))
                except Exception:
                    pass
        
        # 关键词拆分
        keywords = [k.strip().lower() for k in query.split() if k.strip()]
        if not keywords:
            return []
        
        # 计算匹配度并过滤
        scored_posts = []
        for post in all_posts:
            score = 0
            content = post.get("content", "").lower()
            company = post.get("company", "").lower()
            role = post.get("role", "").lower()
            tags = [t.lower() for t in post.get("tags", [])]
            
            for keyword in keywords:
                # 标题匹配（公司/角色）权重更高
                if keyword in company:
                    score += 10
                if keyword in role:
                    score += 10
                # 标签匹配
                if any(keyword in tag for tag in tags):
                    score += 5
                # 内容匹配
                if keyword in content:
                    score += 1
            
            if score > 0:
                post["_match_score"] = score
                scored_posts.append(post)
        
        # 按匹配度排序
        scored_posts.sort(key=lambda x: x["_match_score"], reverse=True)
        
        # 清理临时字段并返回
        for post in scored_posts:
            post.pop("_match_score", None)
        
        return scored_posts[:limit]
    
    def get_post(self, post_id: str, increment_view: bool = True) -> Dict[str, Any]:
        """获取帖子详情"""
        key = make_post_key(post_id)
        val = redis_client.get(key)
        
        if not val:
            raise HTTPException(status_code=404, detail="面经帖子不存在或已被删除")
        
        post = json.loads(val)
        
        # 增加浏览量
        if increment_view:
            post["views_count"] = post.get("views_count", 0) + 1
            redis_client.set(key, json.dumps(post, ensure_ascii=False))
        
        return post
    
    def toggle_like(self, post_id: str, user_email: str) -> Dict[str, Any]:
        """切换点赞状态"""
        key = make_post_key(post_id)
        val = redis_client.get(key)
        
        if not val:
            raise HTTPException(status_code=404, detail="帖子不存在")
        
        post = json.loads(val)
        like_key = make_post_likes_key(post_id)
        is_member = redis_client.sismember(like_key, user_email)
        
        if is_member:
            redis_client.srem(like_key, user_email)
            post["likes_count"] = max(0, post.get("likes_count", 1) - 1)
            action = "unliked"
            liked = False
        else:
            redis_client.sadd(like_key, user_email)
            post["likes_count"] = post.get("likes_count", 0) + 1
            action = "liked"
            liked = True
            
            # 通知作者
            if post.get("author_email") and post.get("author_email") != user_email:
                from services.user_service import user_service
                user = user_service.get_user_by_email(user_email)
                actor_name = user.get("name", "有人") if user else "有人"
                notification_service.push_notification(
                    target_email=post["author_email"],
                    notif_type="like",
                    title="收到新的点赞",
                    body=f"{actor_name} 赞了你的面经「{post.get('company', '')} {post.get('role', '')}」",
                    link=f"/square/{post_id}"
                )
        
        redis_client.set(key, json.dumps(post, ensure_ascii=False))
        
        return {
            "likes_count": post["likes_count"],
            "action": action,
            "is_liked": liked
        }
    
    def get_like_status(self, post_id: str, user_email: str) -> bool:
        """获取点赞状态"""
        like_key = make_post_likes_key(post_id)
        return bool(redis_client.sismember(like_key, user_email))
    
    def delete_post(self, post_id: str, user_email: str) -> bool:
        """删除帖子"""
        key = make_post_key(post_id)
        val = redis_client.get(key)
        
        if not val:
            raise HTTPException(status_code=404, detail="帖子不存在")
        
        post = json.loads(val)
        if post.get("author_email") != user_email:
            raise HTTPException(status_code=403, detail="只能删除自己发布的帖子")
        
        redis_client.delete(key)
        redis_client.lrem("global:post_ids", 1, post_id)
        redis_client.delete(make_post_comments_key(post_id))
        redis_client.delete(make_post_likes_key(post_id))
        
        return True
    
    def create_comment(
        self,
        post_id: str,
        content: str,
        reply_to: str,
        reply_to_name: str,
        user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """创建评论"""
        if not content.strip():
            raise HTTPException(status_code=400, detail="评论内容不可为空")
        
        post = self.get_post(post_id, increment_view=False)
        
        comment = {
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "author_email": user["email"],
            "author_name": user.get("name") or "匿名用户",
            "author_avatar": user.get("avatar_url", ""),
            "content": content.strip(),
            "reply_to": reply_to,
            "reply_to_name": reply_to_name,
            "created_at": now_iso()
        }
        
        redis_client.rpush(
            make_post_comments_key(post_id),
            json.dumps(comment, ensure_ascii=False)
        )
        
        # 更新评论数
        post["comments_count"] = post.get("comments_count", 0) + 1
        redis_client.set(make_post_key(post_id), json.dumps(post, ensure_ascii=False))
        
        # 通知作者
        if post.get("author_email") and post.get("author_email") != user["email"]:
            notification_service.push_notification(
                target_email=post["author_email"],
                notif_type="comment",
                title="收到新评论",
                body=f"{user.get('name', '有人')} 评论了你的面经「{post.get('company', '')} {post.get('role', '')}」：{content[:50]}",
                link=f"/square/{post_id}#{comment['id']}"
            )
        
        return comment
    
    def list_comments(self, post_id: str) -> List[Dict[str, Any]]:
        """获取评论列表"""
        raw_comments = redis_client.lrange(make_post_comments_key(post_id), 0, 500)
        comments = []
        for c in raw_comments:
            try:
                comments.append(json.loads(c))
            except Exception:
                pass
        return comments
    
    def delete_comment(self, post_id: str, comment_id: str, user_email: str) -> bool:
        """删除评论"""
        comments_key = make_post_comments_key(post_id)
        raw_comments = redis_client.lrange(comments_key, 0, 500)
        
        target = None
        for item in raw_comments:
            try:
                parsed = json.loads(item)
                if parsed.get("id") == comment_id:
                    if parsed.get("author_email") != user_email:
                        raise HTTPException(status_code=403, detail="只能删除自己的评论")
                    target = item
                    break
            except HTTPException:
                raise
            except Exception:
                continue
        
        if not target:
            raise HTTPException(status_code=404, detail="评论不存在")
        
        redis_client.lrem(comments_key, 1, target)
        
        # 更新评论数
        post_key = make_post_key(post_id)
        pval = redis_client.get(post_key)
        if pval:
            p = json.loads(pval)
            p["comments_count"] = max(0, p.get("comments_count", 1) - 1)
            redis_client.set(post_key, json.dumps(p, ensure_ascii=False))
        
        return True
    
    def toggle_comment_like(self, comment_id: str, user_email: str) -> Dict[str, Any]:
        """切换评论点赞"""
        like_key = make_comment_likes_key(comment_id)
        is_member = redis_client.sismember(like_key, user_email)
        
        if is_member:
            redis_client.srem(like_key, user_email)
            liked = False
        else:
            redis_client.sadd(like_key, user_email)
            liked = True
        
        likes_count = redis_client.scard(like_key)
        return {"is_liked": liked, "likes_count": likes_count}
    
    def get_comment_like_status(self, comment_id: str, user_email: str) -> Dict[str, Any]:
        """获取评论点赞状态"""
        like_key = make_comment_likes_key(comment_id)
        is_member = redis_client.sismember(like_key, user_email)
        likes_count = redis_client.scard(like_key)
        return {"is_liked": bool(is_member), "likes_count": likes_count}


# 全局帖子服务实例
post_service = PostService()
