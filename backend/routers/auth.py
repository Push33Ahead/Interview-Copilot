"""认证相关路由"""

from typing import Any, Dict
from fastapi import APIRouter, Header, UploadFile, File

from models.schemas import (
    RegisterRequest, LoginRequest, SendRegisterCodeRequest, UpdateProfileRequest
)
from services.user_service import user_service
from core.security import get_current_user_from_auth_header

router = APIRouter(prefix="/api/auth", tags=["认证"])


@router.post("/send-register-code")
async def send_register_code(request: SendRegisterCodeRequest):
    """发送注册验证码"""
    data = user_service.send_register_code(request.email)
    return {"code": 200, "data": data}


@router.post("/register")
async def auth_register(request: RegisterRequest):
    """用户注册"""
    user_data = user_service.register(
        name=request.name,
        email=request.email,
        password=request.password,
        verification_code=request.verification_code
    )
    return {"code": 200, "data": user_data}


@router.post("/login")
async def auth_login(request: LoginRequest):
    """用户登录"""
    result = user_service.login(request.email, request.password)
    return {"code": 200, "data": result}


@router.get("/me")
async def auth_me(authorization: str = Header(None)):
    """获取当前用户信息"""
    user = get_current_user_from_auth_header(authorization)
    return {"code": 200, "data": user_service.sanitize_user_profile(user)}


@router.post("/logout")
async def auth_logout(authorization: str = Header(None)):
    """用户登出"""
    user = get_current_user_from_auth_header(authorization)
    user_service.logout(user["token"])
    return {"code": 200, "data": True}


@router.put("/profile")
async def auth_update_profile(
    request: UpdateProfileRequest,
    authorization: str = Header(None)
):
    """更新用户资料"""
    user = get_current_user_from_auth_header(authorization)
    updated = user_service.update_profile(
        email=user["email"],
        name=request.name,
        target_role=request.target_role,
        work_experience_years=request.work_experience_years,
        desired_city=request.desired_city,
        expected_salary=request.expected_salary,
        skills=request.skills,
        bio=request.bio
    )
    return {"code": 200, "data": updated}


@router.post("/avatar")
async def auth_upload_avatar(
    avatar: UploadFile = File(...),
    authorization: str = Header(None)
):
    """上传头像"""
    user = get_current_user_from_auth_header(authorization)
    updated = await user_service.upload_avatar(user["email"], avatar)
    return {"code": 200, "data": updated}
