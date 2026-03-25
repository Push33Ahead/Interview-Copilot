import fitz  # PyMuPDF
import json
import uuid
import re
import redis
import hashlib
import hmac
import os
import smtplib
import ssl
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from openai import OpenAI
from email.message import EmailMessage

# ================= 1. 初始化服务与配置 =================
app = FastAPI(title="AI Interview API")

UPLOAD_BASE_DIR = Path(os.getenv("UPLOAD_BASE_DIR", "uploads"))
AVATAR_DIR = UPLOAD_BASE_DIR / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

def parse_cors_origins() -> List[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if raw:
        origins = [x.strip() for x in raw.split(",") if x.strip()]
        if origins:
            return origins
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_BASE_DIR)), name="uploads")

redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 天
REGISTER_CODE_TTL_SECONDS = 300  # 5 分钟
REGISTER_CODE_COOLDOWN_SECONDS = 60  # 60 秒可重发

client = OpenAI(
    api_key="sk-ctwyk9nnodkhkuwdolwlzt2oyot92xyp9u0jdrpo84et26he",
    base_url="https://api.xiaomimimo.com/v1"
)

# ================= 2. 工具函数 =================

def call_mimo_api(messages, max_tokens=2000, temperature=0.3, force_json=False):
    """调用大模型"""
    payload = {
        "model": "mimo-v2-pro",
        "messages": messages,
        "max_completion_tokens": max_tokens,
        "temperature": temperature,
        "top_p": 0.95
    }
    if force_json:
        payload["response_format"] = {"type": "json_object"}

    try:
        completion = client.chat.completions.create(**payload)
        return completion.choices[0].message.content
    except Exception as e:
        # 兼容不支持 response_format 的第三方网关
        if force_json:
            try:
                fallback_payload = dict(payload)
                fallback_payload.pop("response_format", None)
                completion = client.chat.completions.create(**fallback_payload)
                return completion.choices[0].message.content
            except Exception:
                pass
        print("API调用报错:", str(e))
        raise HTTPException(status_code=500, detail="大模型接口异常")


def extract_json(text):
    """提取干净 JSON"""
    if not text:
        raise ValueError("空输出")

    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
    text = re.sub(r"\s*```$", "", text)

    # 先尝试整段作为 JSON
    try:
        parsed = json.loads(text)
        return json.dumps(parsed, ensure_ascii=False)
    except Exception:
        pass

    # 再从文本中扫描第一个可被解析的 JSON 对象
    decoder = json.JSONDecoder()
    for i, ch in enumerate(text):
        if ch != "{":
            continue
        try:
            obj, _ = decoder.raw_decode(text[i:])
            if isinstance(obj, dict):
                return json.dumps(obj, ensure_ascii=False)
        except Exception:
            continue

    raise ValueError("未找到JSON")


def safe_json_load(text):
    """安全解析 JSON"""
    try:
        return json.loads(text)
    except Exception:
        return None


def normalize_report(data: Dict[str, Any]) -> Dict[str, Any]:
    """修正模型输出结构，避免前端因字段缺失崩溃"""
    if not isinstance(data, dict):
        raise ValueError("报告不是JSON对象")

    score = data.get("score", 0)
    try:
        score = int(float(score))
    except Exception:
        score = 0
    score = max(0, min(100, score))

    overall_summary = data.get("overall_summary", "")
    if not isinstance(overall_summary, str):
        overall_summary = str(overall_summary)

    answer_improvements_raw = data.get("answer_improvements", [])
    answer_improvements: List[Dict[str, str]] = []
    if isinstance(answer_improvements_raw, list):
        for item in answer_improvements_raw:
            if not isinstance(item, dict):
                continue
            answer_improvements.append({
                "question": str(item.get("question", "")),
                "user_answer": str(item.get("user_answer", "")),
                "suggestion": str(item.get("suggestion", "")),
                "good_example": str(item.get("good_example", ""))
            })

    resume_optimizations_raw = data.get("resume_optimizations", [])
    resume_optimizations: List[str] = []
    if isinstance(resume_optimizations_raw, list):
        resume_optimizations = [str(x) for x in resume_optimizations_raw if str(x).strip()]

    return {
        "score": score,
        "overall_summary": overall_summary,
        "answer_improvements": answer_improvements,
        "resume_optimizations": resume_optimizations
    }


def robust_json_parse(raw_text, messages):
    """带重试的JSON解析"""
    last_error = "未知错误"
    for i in range(3):  # 最多重试 3 次
        try:
            cleaned = extract_json(raw_text)
            data = safe_json_load(cleaned)
            if data:
                return normalize_report(data)
            last_error = "json.loads 返回空"
        except Exception as e:
            last_error = str(e)

        print(f"解析失败，第{i+1}次重试，原因: {last_error}")
        repair_messages = messages + [
            {"role": "assistant", "content": str(raw_text)},
            {"role": "user", "content": (
                "你上一次输出无法解析。请只返回一个合法JSON对象，不要Markdown，不要解释，不要代码块。"
                "必须包含键：score, overall_summary, answer_improvements, resume_optimizations。"
            )}
        ]
        raw_text = call_mimo_api(repair_messages, max_tokens=2200, temperature=0.1, force_json=True)

    raise HTTPException(status_code=500, detail=f"JSON解析失败（模型输出不稳定）：{last_error}")


def build_evaluate_prompt(session: Dict[str, Any]) -> str:
    """构建更短更稳的评估输入，降低模型截断概率"""
    resume_text = (session.get("resume_text") or "")[:6000]
    dialog = [m for m in session.get("messages", []) if m.get("role") in ("user", "assistant")]
    # 仅保留最近 24 条，避免输入过长导致输出截断
    dialog = dialog[-24:]
    chat_str = json.dumps(dialog, ensure_ascii=False)

    return f"""
你不是聊天助手，你是一个 API。必须返回严格 JSON，不允许任何解释。不要输出 Markdown，不要输出代码块。
岗位: {session.get('job_title', '')}
需求: {(session.get('job_description') or '')[:3000]}
简历: {resume_text}
对话: {chat_str}

返回结构：{{
 "score": 80,
 "overall_summary": "",
 "answer_improvements":[
  {{
   "question":"",
   "user_answer":"",
   "suggestion":"",
   "good_example":""
  }}
 ],
 "resume_optimizations":[]
}}
"""


# ================= 3. 数据模型 =================

class ChatRequest(BaseModel):
    session_id: str
    user_answer: str

class EvaluateRequest(BaseModel):
    session_id: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    verification_code: str

class LoginRequest(BaseModel):
    email: str
    password: str

class SendRegisterCodeRequest(BaseModel):
    email: str

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    target_role: Optional[str] = None
    work_experience_years: Optional[int] = None
    desired_city: Optional[str] = None
    expected_salary: Optional[str] = None
    skills: Optional[List[str]] = None
    bio: Optional[str] = None


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def hash_password(password: str) -> str:
    return hashlib.sha256((password or "").encode("utf-8")).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hmac.compare_digest(hash_password(password), password_hash or "")


def make_user_key(email: str) -> str:
    return f"user:{normalize_email(email)}"


def make_auth_key(token: str) -> str:
    return f"auth:{token}"


def make_register_code_key(email: str) -> str:
    return f"register_code:{normalize_email(email)}"


def make_register_cooldown_key(email: str) -> str:
    return f"register_cooldown:{normalize_email(email)}"

def make_user_reports_key(email: str) -> str:
    return f"user_reports:{normalize_email(email)}"

def make_report_detail_key(report_id: str) -> str:
    return f"report:{report_id}"

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def sanitize_user_profile(user_data: Dict[str, Any]) -> Dict[str, Any]:
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


def generate_verification_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def get_smtp_config() -> Dict[str, Any]:
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "465"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASS", "").strip()
    sender = os.getenv("SMTP_FROM", user).strip()
    use_ssl = os.getenv("SMTP_USE_SSL", "true").lower() in ("1", "true", "yes")
    if not host or not user or not password or not sender:
        raise HTTPException(status_code=500, detail="SMTP 未配置完整")
    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "sender": sender,
        "use_ssl": use_ssl
    }


def send_register_code_email(receiver_email: str, code: str):
    cfg = get_smtp_config()
    msg = EmailMessage()
    msg["Subject"] = "Interview Copilot 注册验证码"
    msg["From"] = cfg["sender"]
    msg["To"] = receiver_email
    msg.set_content(
        f"欢迎使用Interview Copilot!"
        f"你的注册验证码是：{code}\n"
        f"有效期：{REGISTER_CODE_TTL_SECONDS // 60} 分钟。\n"
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


def parse_bearer_token(authorization: str) -> str:
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
    token = parse_bearer_token(authorization)
    auth_key = make_auth_key(token)
    user_email = redis_client.get(auth_key)
    if not user_email:
        raise HTTPException(status_code=401, detail="登录态已失效，请重新登录")

    user_raw = redis_client.get(make_user_key(user_email))
    if not user_raw:
        raise HTTPException(status_code=401, detail="用户不存在")

    user_data = json.loads(user_raw)
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


# ================= 4. API =================

@app.post("/api/auth/send-register-code")
async def send_register_code(request: SendRegisterCodeRequest):
    email = normalize_email(request.email)
    if not email:
        raise HTTPException(status_code=400, detail="邮箱不能为空")
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")

    if redis_client.exists(make_user_key(email)):
        raise HTTPException(status_code=409, detail="该邮箱已注册")

    cooldown_key = make_register_cooldown_key(email)
    ttl_left = redis_client.ttl(cooldown_key)
    if ttl_left and ttl_left > 0:
        raise HTTPException(status_code=429, detail=f"请求过于频繁，请 {ttl_left} 秒后重试")

    code = generate_verification_code()
    code_hash = hash_password(code)

    send_register_code_email(email, code)
    redis_client.setex(make_register_code_key(email), REGISTER_CODE_TTL_SECONDS, code_hash)
    redis_client.setex(cooldown_key, REGISTER_CODE_COOLDOWN_SECONDS, "1")

    return {
        "code": 200,
        "data": {
            "expire_seconds": REGISTER_CODE_TTL_SECONDS
        }
    }


@app.post("/api/auth/register")
async def auth_register(request: RegisterRequest):
    name = (request.name or "").strip()
    email = normalize_email(request.email)
    password = request.password or ""
    verification_code = (request.verification_code or "").strip()

    if not email:
        raise HTTPException(status_code=400, detail="邮箱不能为空")
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")
    if not verification_code:
        raise HTTPException(status_code=400, detail="请输入邮箱验证码")

    user_key = make_user_key(email)
    if redis_client.exists(user_key):
        raise HTTPException(status_code=409, detail="该邮箱已注册")

    code_hash = redis_client.get(make_register_code_key(email))
    if not code_hash:
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")
    if not verify_password(verification_code, code_hash):
        raise HTTPException(status_code=400, detail="验证码错误")

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

    return {
        "code": 200,
        "data": {
            "name": name,
            "email": email,
            "avatar_url": "",
            "created_at": user_data["created_at"],
            "target_role": "",
            "work_experience_years": 0,
            "desired_city": "",
            "expected_salary": "",
            "skills": [],
            "bio": ""
        }
    }


@app.post("/api/auth/login")
async def auth_login(request: LoginRequest):
    email = normalize_email(request.email)
    password = request.password or ""

    if not email or not password:
        raise HTTPException(status_code=400, detail="邮箱和密码不能为空")

    user_raw = redis_client.get(make_user_key(email))
    if not user_raw:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    user_data = json.loads(user_raw)
    if not verify_password(password, user_data.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    if not user_data.get("created_at"):
        user_data["created_at"] = now_iso()
        redis_client.set(make_user_key(email), json.dumps(user_data, ensure_ascii=False))

    token = str(uuid.uuid4())
    auth_key = make_auth_key(token)
    redis_client.setex(auth_key, AUTH_TOKEN_TTL_SECONDS, email)

    return {
        "code": 200,
        "data": {
            "token": token,
            "user": {
                "name": user_data.get("name", ""),
                "email": user_data.get("email", ""),
                "avatar_url": user_data.get("avatar_url", ""),
                "created_at": user_data.get("created_at", ""),
                "target_role": user_data.get("target_role", ""),
                "work_experience_years": user_data.get("work_experience_years", 0),
                "desired_city": user_data.get("desired_city", ""),
                "expected_salary": user_data.get("expected_salary", ""),
                "skills": user_data.get("skills", []),
                "bio": user_data.get("bio", "")
            }
        }
    }


@app.get("/api/auth/me")
async def auth_me(authorization: str = Header(None)):
    user = get_current_user_from_auth_header(authorization)
    return {
        "code": 200,
        "data": sanitize_user_profile(user)
    }


@app.post("/api/auth/logout")
async def auth_logout(authorization: str = Header(None)):
    user = get_current_user_from_auth_header(authorization)
    redis_client.delete(make_auth_key(user["token"]))
    return {
        "code": 200,
        "data": True
    }


@app.put("/api/auth/profile")
async def auth_update_profile(request: UpdateProfileRequest, authorization: str = Header(None)):
    user = get_current_user_from_auth_header(authorization)
    user_key = make_user_key(user["email"])
    user_raw = redis_client.get(user_key)
    if not user_raw:
        raise HTTPException(status_code=404, detail="用户不存在")

    user_data = json.loads(user_raw)
    if request.name is not None:
        new_name = request.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="昵称不能为空")
        if len(new_name) > 40:
            raise HTTPException(status_code=400, detail="昵称长度不能超过 40")
        user_data["name"] = new_name

    if request.target_role is not None:
        target_role = request.target_role.strip()
        if len(target_role) > 80:
            raise HTTPException(status_code=400, detail="目标岗位长度不能超过 80")
        user_data["target_role"] = target_role

    if request.work_experience_years is not None:
        years = int(request.work_experience_years)
        if years < 0 or years > 60:
            raise HTTPException(status_code=400, detail="工作年限范围不合法")
        user_data["work_experience_years"] = years

    if request.desired_city is not None:
        city = request.desired_city.strip()
        if len(city) > 80:
            raise HTTPException(status_code=400, detail="期望城市长度不能超过 80")
        user_data["desired_city"] = city

    if request.expected_salary is not None:
        expected_salary = request.expected_salary.strip()
        if len(expected_salary) > 80:
            raise HTTPException(status_code=400, detail="薪资字段长度不能超过 80")
        user_data["expected_salary"] = expected_salary

    if request.skills is not None:
        skills = [str(x).strip() for x in request.skills if str(x).strip()]
        if len(skills) > 40:
            raise HTTPException(status_code=400, detail="技能数量不能超过 40")
        user_data["skills"] = skills

    if request.bio is not None:
        bio = request.bio.strip()
        if len(bio) > 500:
            raise HTTPException(status_code=400, detail="个人简介长度不能超过 500")
        user_data["bio"] = bio

    redis_client.set(user_key, json.dumps(user_data, ensure_ascii=False))
    return {
        "code": 200,
        "data": sanitize_user_profile(user_data)
    }


@app.post("/api/auth/avatar")
async def auth_upload_avatar(
    avatar: UploadFile = File(...),
    authorization: str = Header(None)
):
    user = get_current_user_from_auth_header(authorization)
    user_key = make_user_key(user["email"])
    user_raw = redis_client.get(user_key)
    if not user_raw:
        raise HTTPException(status_code=404, detail="用户不存在")

    content_type = (avatar.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="仅支持图片文件")

    data = await avatar.read()
    if not data:
        raise HTTPException(status_code=400, detail="上传文件为空")
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="头像大小不能超过 5MB")

    ext_map = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif"
    }
    ext = ext_map.get(content_type, ".jpg")
    filename = f"{uuid.uuid4().hex}{ext}"
    save_path = AVATAR_DIR / filename
    with open(save_path, "wb") as f:
        f.write(data)

    avatar_url = f"/uploads/avatars/{filename}"
    user_data = json.loads(user_raw)
    user_data["avatar_url"] = avatar_url
    redis_client.set(user_key, json.dumps(user_data, ensure_ascii=False))

    return {
        "code": 200,
        "data": sanitize_user_profile(user_data)
    }


@app.get("/api/reports")
async def list_reports(authorization: str = Header(None)):
    user = get_current_user_from_auth_header(authorization)
    report_items = redis_client.lrange(make_user_reports_key(user["email"]), 0, 99)

    reports: List[Dict[str, Any]] = []
    for item in report_items:
        try:
            parsed = json.loads(item)
            if isinstance(parsed, dict):
                reports.append(parsed)
        except Exception:
            continue

    return {
        "code": 200,
        "data": reports
    }


@app.get("/api/reports/{report_id}")
async def get_report_detail(report_id: str, authorization: str = Header(None)):
    user = get_current_user_from_auth_header(authorization)
    report_raw = redis_client.get(make_report_detail_key(report_id))
    if not report_raw:
        raise HTTPException(status_code=404, detail="评估记录不存在或已过期")

    report_data = json.loads(report_raw)
    # 二次校验：必须是当前用户的报告
    reports_raw = redis_client.lrange(make_user_reports_key(user["email"]), 0, 200)
    owned_ids = set()
    for item in reports_raw:
        try:
            parsed = json.loads(item)
            rid = str(parsed.get("id", ""))
            if rid:
                owned_ids.add(rid)
        except Exception:
            continue
    if report_id not in owned_ids:
        raise HTTPException(status_code=403, detail="无权访问该评估记录")

    return {
        "code": 200,
        "data": report_data
    }

@app.delete("/api/reports/{report_id}")
async def delete_report(report_id: str, authorization: str = Header(None)):
    user = get_current_user_from_auth_header(authorization)
    user_reports_key = make_user_reports_key(user["email"])
    reports_raw = redis_client.lrange(user_reports_key, 0, 200)
    
    target_item = None
    for item in reports_raw:
        try:
            parsed = json.loads(item)
            if str(parsed.get("id", "")) == report_id:
                target_item = item
                break
        except Exception:
            continue
            
    if not target_item:
        raise HTTPException(status_code=404, detail="评估记录不存在或无权删除")
        
    redis_client.lrem(user_reports_key, 1, target_item)
    redis_client.delete(make_report_detail_key(report_id))
    
    return {
        "code": 200,
        "data": True
    }

@app.post("/api/init-interview")
async def init_interview(
    job_title: str = Form(...),
    job_description: str = Form(...),
    resume: UploadFile = File(...),
    authorization: str = Header(None)
):
    user = get_current_user_from_auth_header(authorization)

    if not resume.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="只接受PDF")

    pdf_bytes = await resume.read()

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        resume_text = "".join([p.get_text() for p in doc])
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail="PDF解析失败")

    system_prompt = f"""
你是资深{job_title}面试官。
岗位需求:
{job_description}

候选人简历:
{resume_text}

规则：1. 每次只问一个问题 2. 紧扣技能和简历 3. 不说废话
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "开始面试"}
    ]

    first_question = call_mimo_api(messages)
    messages.append({"role": "assistant", "content": first_question})

    session_id = str(uuid.uuid4())
    session_data = {
        "owner_email": user["email"],
        "job_title": job_title,
        "job_description": job_description,
        "resume_text": resume_text,
        "turn_count": 1,
        "messages": messages
    }

    redis_client.setex(f"session:{session_id}", 7200, json.dumps(session_data, ensure_ascii=False))

    return {
        "code": 200,
        "data": {
            "session_id": session_id,
            "first_question": first_question
        }
    }


@app.post("/api/chat")
async def chat(request: ChatRequest, authorization: str = Header(None)):
    user = get_current_user_from_auth_header(authorization)
    key = f"session:{request.session_id}"
    data_str = redis_client.get(key)

    if not data_str:
        raise HTTPException(404, "session不存在")

    session = json.loads(data_str)
    owner_email = session.get("owner_email", "")
    if owner_email and owner_email != user["email"]:
        raise HTTPException(status_code=403, detail="无权访问该面试会话")
    if not owner_email:
        session["owner_email"] = user["email"]

    session["messages"].append({"role": "user", "content": request.user_answer})

    if session["turn_count"] >= 15:
        return {
            "code": 200,
            "data": {
                "next_question": "面试结束",
                "is_finished": True
            }
        }

    next_q = call_mimo_api(session["messages"])
    session["messages"].append({"role": "assistant", "content": next_q})
    session["turn_count"] += 1

    redis_client.setex(key, 7200, json.dumps(session, ensure_ascii=False))

    return {
        "code": 200,
        "data": {
            "next_question": next_q,
            "turn_count": session["turn_count"],
            "is_finished": False
        }
    }


@app.post("/api/evaluate")
async def evaluate(request: EvaluateRequest, authorization: str = Header(None)):
    user = get_current_user_from_auth_header(authorization)
    key = f"session:{request.session_id}"
    data_str = redis_client.get(key)

    if not data_str:
        raise HTTPException(404, "session不存在")

    session = json.loads(data_str)
    owner_email = session.get("owner_email", "")
    if owner_email and owner_email != user["email"]:
        raise HTTPException(status_code=403, detail="无权访问该面试会话")
    if not owner_email:
        session["owner_email"] = user["email"]
        redis_client.setex(key, 7200, json.dumps(session, ensure_ascii=False))

    eval_prompt = build_evaluate_prompt(session)

    messages = [{"role": "user", "content": eval_prompt}]
    raw = call_mimo_api(messages, max_tokens=2200, temperature=0.1, force_json=True)

    print("原始返回:", raw)

    try:
        report = robust_json_parse(raw, messages)
    except HTTPException as e:
        detail_text = e.detail if isinstance(e.detail, str) else str(e.detail)
        raise HTTPException(
            status_code=e.status_code,
            detail={
                "message": detail_text,
                "raw_model_output": str(raw)[:8000]
            }
        )

    report_id = str(uuid.uuid4())
    report_summary = {
        "id": report_id,
        "score": report.get("score", 0),
        "overall_summary": report.get("overall_summary", ""),
        "job_title": session.get("job_title", ""),
        "created_at": now_iso()
    }
    report_detail = {
        "id": report_id,
        "created_at": report_summary["created_at"],
        "job_title": report_summary["job_title"],
        "report": report
    }
    user_reports_key = make_user_reports_key(user["email"])
    redis_client.lpush(user_reports_key, json.dumps(report_summary, ensure_ascii=False))
    redis_client.ltrim(user_reports_key, 0, 99)
    redis_client.setex(make_report_detail_key(report_id), 60 * 60 * 24 * 90, json.dumps(report_detail, ensure_ascii=False))

    return {
        "code": 200,
        "data": report,
        "meta": {
            "report_id": report_id
        },
        "debug": {
            "raw_model_output": str(raw)[:8000]
        }
    }
