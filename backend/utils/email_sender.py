"""邮件发送工具"""

import random
import smtplib
import ssl
from email.message import EmailMessage
from typing import Dict, Any

from fastapi import HTTPException

from config.settings import settings
from config.constants import REGISTER_CODE_TTL_SECONDS


def generate_verification_code() -> str:
    """生成 6 位数字验证码"""
    return f"{random.randint(0, 999999):06d}"


def get_smtp_config() -> Dict[str, Any]:
    """获取 SMTP 配置"""
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASS or not settings.SMTP_FROM:
        raise HTTPException(status_code=500, detail="SMTP 未配置完整")
    
    return {
        "host": settings.SMTP_HOST,
        "port": settings.SMTP_PORT,
        "user": settings.SMTP_USER,
        "password": settings.SMTP_PASS,
        "sender": settings.SMTP_FROM,
        "use_ssl": settings.SMTP_USE_SSL
    }


def send_register_code_email(receiver_email: str, code: str):
    """发送注册验证码邮件"""
    cfg = get_smtp_config()
    
    msg = EmailMessage()
    msg["Subject"] = "Interview Copilot 注册验证码"
    msg["From"] = cfg["sender"]
    msg["To"] = receiver_email
    msg.set_content(
        f"欢迎使用 Interview Copilot!\n\n"
        f"你的注册验证码是：{code}\n"
        f"有效期：{REGISTER_CODE_TTL_SECONDS // 60} 分钟。\n\n"
        "如果不是你本人操作，请忽略此邮件。"
    )
    
    try:
        if cfg["use_ssl"]:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], context=context, timeout=10) as smtp:
                smtp.login(cfg["user"], cfg["password"])
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=10) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(cfg["user"], cfg["password"])
                smtp.send_message(msg)
    except Exception as e:
        print("发送验证码邮件失败:", str(e))
        raise HTTPException(status_code=500, detail="验证码发送失败，请稍后重试")
