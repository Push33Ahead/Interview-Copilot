"""用户业务服务"""

import json
import uuid
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, UploadFile

from config.constants import AUTH_TOKEN_TTL_SECONDS, REGISTER_CODE_TTL_SECONDS, REGISTER_CODE_COOLDOWN_SECONDS, MAX_AVATAR_SIZE, ALLOWED_IMAGE_TYPES
from core.redis_client import (
    redis_client, make_user_key, make_auth_key,
    make_register_code_key, make_register_cooldown_key
)
from core.security import (
    hash_password, verify_password, normalize_email,
    generate_token, now_iso
)
from utils.email_sender import send_register_code_email, generate_verification_code
from config.settings import settings


class UserService:
    """用户服务类"""
    
    def sanitize_user_profile(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """清理用户资料"""
        avatar_url = user_data.get("avatar_url")
        created_at = user_data.get("created_at")
        
        skills_raw = user_data.get("skills", [])
        skills: List[str] = []
        if isinstance(skills_raw, list):
            skills = [str(x).strip() for x in skills_raw if str(x).strip()]
        elif isinstance(skills_raw, str) and skills_raw.strip():
            skills = [x.strip() for x in skills_raw.split(",") if x.strip()]
        
        return {
            "name": str(user_data.get("name", "") or ""),
            "email": str(user_data.get("email", "") or ""),
            "avatar_url": str(avatar_url or ""),
            "created_at": str(created_at or ""),
            "target_role": str(user_data.get("target_role", "") or ""),
            "work_experience_years": int(user_data.get("work_experience_years", 0) or 0),
            "desired_city": str(user_data.get("desired_city", "") or ""),
            "expected_salary": str(user_data.get("expected_salary", "") or ""),
            "skills": skills,
            "bio": str(user_data.get("bio", "") or ""),
        }
    
    def send_register_code(self, email: str) -> Dict[str, Any]:
        """发送注册验证码"""
        email = normalize_email(email)
        
        if not email:
            raise HTTPException(status_code=400, detail="邮箱不能为空")
        
        # 检查是否已注册
        if redis_client.exists(make_user_key(email)):
            raise HTTPException(status_code=409, detail="该邮箱已注册")
        
        # 检查冷却时间
        cooldown_key = make_register_cooldown_key(email)
        ttl_left = redis_client.ttl(cooldown_key)
        if ttl_left and ttl_left > 0:
            raise HTTPException(status_code=429, detail=f"请求过于频繁，请 {ttl_left} 秒后重试")
        
        # 生成并发送验证码
        code = generate_verification_code()
        code_hash = hash_password(code)
        
        send_register_code_email(email, code)
        redis_client.setex(make_register_code_key(email), REGISTER_CODE_TTL_SECONDS, code_hash)
        redis_client.setex(cooldown_key, REGISTER_CODE_COOLDOWN_SECONDS, "1")
        
        return {"expire_seconds": REGISTER_CODE_TTL_SECONDS}
    
    def register(
        self,
        name: str,
        email: str,
        password: str,
        verification_code: str
    ) -> Dict[str, Any]:
        """用户注册"""
        email = normalize_email(email)
        
        if not email:
            raise HTTPException(status_code=400, detail="邮箱不能为空")
        if len(password) < 6:
            raise HTTPException(status_code=400, detail="密码至少 6 位")
        if not verification_code:
            raise HTTPException(status_code=400, detail="请输入邮箱验证码")
        
        # 检查是否已注册
        user_key = make_user_key(email)
        if redis_client.exists(user_key):
            raise HTTPException(status_code=409, detail="该邮箱已注册")
        
        # 验证验证码
        code_hash = redis_client.get(make_register_code_key(email))
        if not code_hash:
            raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")
        if not verify_password(verification_code, code_hash):
            raise HTTPException(status_code=400, detail="验证码错误")
        
        # 创建用户
        if not name:
            name = email.split("@")[0]
        
        user_data = {
            "name": name,
            "email": email,
            "password_hash": hash_password(password),
            "avatar_url": "",
            "created_at": now_iso(),
            "target_role": "",
            "work_experience_years": 0,
            "desired_city": "",
            "expected_salary": "",
            "skills": [],
            "bio": ""
        }
        
        redis_client.set(user_key, json.dumps(user_data, ensure_ascii=False))
        redis_client.delete(make_register_code_key(email))
        redis_client.delete(make_register_cooldown_key(email))
        
        return self.sanitize_user_profile(user_data)
    
    def login(self, email: str, password: str) -> Dict[str, Any]:
        """用户登录"""
        email = normalize_email(email)
        
        if not email or not password:
            raise HTTPException(status_code=400, detail="邮箱和密码不能为空")
        
        # 获取用户
        user_raw = redis_client.get(make_user_key(email))
        if not user_raw:
            raise HTTPException(status_code=401, detail="邮箱或密码错误")
        
        user_data = json.loads(user_raw)
        if not verify_password(password, user_data.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="邮箱或密码错误")
        
        # 确保 created_at 存在
        if not user_data.get("created_at"):
            user_data["created_at"] = now_iso()
            redis_client.set(make_user_key(email), json.dumps(user_data, ensure_ascii=False))
        
        # 生成 Token
        token = generate_token()
        auth_key = make_auth_key(token)
        redis_client.setex(auth_key, AUTH_TOKEN_TTL_SECONDS, email)
        
        return {
            "token": token,
            "user": self.sanitize_user_profile(user_data)
        }
    
    def logout(self, token: str) -> bool:
        """用户登出"""
        redis_client.delete(make_auth_key(token))
        return True
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """通过邮箱获取用户"""
        user_raw = redis_client.get(make_user_key(email))
        if not user_raw:
            return None
        return json.loads(user_raw)
    
    def update_profile(
        self,
        email: str,
        name: Optional[str] = None,
        target_role: Optional[str] = None,
        work_experience_years: Optional[int] = None,
        desired_city: Optional[str] = None,
        expected_salary: Optional[str] = None,
        skills: Optional[List[str]] = None,
        bio: Optional[str] = None
    ) -> Dict[str, Any]:
        """更新用户资料"""
        user_key = make_user_key(email)
        user_raw = redis_client.get(user_key)
        if not user_raw:
            raise HTTPException(status_code=404, detail="用户不存在")
        
        user_data = json.loads(user_raw)
        
        # 更新字段
        if name is not None:
            new_name = name.strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="昵称不能为空")
            if len(new_name) > 40:
                raise HTTPException(status_code=400, detail="昵称长度不能超过 40")
            user_data["name"] = new_name
        
        if target_role is not None:
            target_role = target_role.strip()
            if len(target_role) > 80:
                raise HTTPException(status_code=400, detail="目标岗位长度不能超过 80")
            user_data["target_role"] = target_role
        
        if work_experience_years is not None:
            years = int(work_experience_years)
            if years < 0 or years > 60:
                raise HTTPException(status_code=400, detail="工作年限范围不合法")
            user_data["work_experience_years"] = years
        
        if desired_city is not None:
            city = desired_city.strip()
            if len(city) > 80:
                raise HTTPException(status_code=400, detail="期望城市长度不能超过 80")
            user_data["desired_city"] = city
        
        if expected_salary is not None:
            salary = expected_salary.strip()
            if len(salary) > 80:
                raise HTTPException(status_code=400, detail="薪资字段长度不能超过 80")
            user_data["expected_salary"] = salary
        
        if skills is not None:
            skills_list = [str(x).strip() for x in skills if str(x).strip()]
            if len(skills_list) > 40:
                raise HTTPException(status_code=400, detail="技能数量不能超过 40")
            user_data["skills"] = skills_list
        
        if bio is not None:
            bio_text = bio.strip()
            if len(bio_text) > 500:
                raise HTTPException(status_code=400, detail="个人简介长度不能超过 500")
            user_data["bio"] = bio_text
        
        redis_client.set(user_key, json.dumps(user_data, ensure_ascii=False))
        return self.sanitize_user_profile(user_data)
    
    async def upload_avatar(self, email: str, avatar: UploadFile) -> Dict[str, Any]:
        """上传头像"""
        user_key = make_user_key(email)
        user_raw = redis_client.get(user_key)
        if not user_raw:
            raise HTTPException(status_code=404, detail="用户不存在")
        
        # 验证文件类型
        content_type = (avatar.content_type or "").lower()
        if not content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="仅支持图片文件")
        
        # 读取文件
        data = await avatar.read()
        if not data:
            raise HTTPException(status_code=400, detail="上传文件为空")
        if len(data) > MAX_AVATAR_SIZE:
            raise HTTPException(status_code=400, detail="头像大小不能超过 5MB")
        
        # 保存文件
        ext_map = {
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif"
        }
        ext = ext_map.get(content_type, ".jpg")
        filename = f"{uuid.uuid4().hex}{ext}"
        save_path = settings.AVATAR_DIR / filename
        
        with open(save_path, "wb") as f:
            f.write(data)
        
        # 更新用户资料
        avatar_url = f"/uploads/avatars/{filename}"
        user_data = json.loads(user_raw)
        user_data["avatar_url"] = avatar_url
        redis_client.set(user_key, json.dumps(user_data, ensure_ascii=False))
        
        return self.sanitize_user_profile(user_data)


# 全局用户服务实例
user_service = UserService()
