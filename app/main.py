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
from typing import Any, Dict, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from email.message import EmailMessage

# ================= 1. 初始化服务与配置 =================
app = FastAPI(title="AI Interview API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    for i in range(3):  # 最多重试2次
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
你不是聊天助手，你是一个API。
必须返回严格JSON，不允许任何解释。
不要输出Markdown，不要输出代码块。

岗位: {session.get('job_title', '')}
需求: {(session.get('job_description') or '')[:3000]}
简历: {resume_text}
对话: {chat_str}

返回结构：
{{
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
    msg["Subject"] = "Interview Copilot注册验证码"
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
        "password_hash": hash_password(password)
    }
    redis_client.set(user_key, json.dumps(user_data, ensure_ascii=False))
    redis_client.delete(make_register_code_key(email))
    redis_client.delete(make_register_cooldown_key(email))

    return {
        "code": 200,
        "data": {
            "name": name,
            "email": email
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

    token = str(uuid.uuid4())
    auth_key = make_auth_key(token)
    redis_client.setex(auth_key, AUTH_TOKEN_TTL_SECONDS, email)

    return {
        "code": 200,
        "data": {
            "token": token,
            "user": {
                "name": user_data.get("name", ""),
                "email": user_data.get("email", "")
            }
        }
    }


@app.get("/api/auth/me")
async def auth_me(authorization: str = Header(None)):
    user = get_current_user_from_auth_header(authorization)
    return {
        "code": 200,
        "data": {
            "name": user["name"],
            "email": user["email"]
        }
    }


@app.post("/api/auth/logout")
async def auth_logout(authorization: str = Header(None)):
    user = get_current_user_from_auth_header(authorization)
    redis_client.delete(make_auth_key(user["token"]))
    return {
        "code": 200,
        "data": True
    }

@app.post("/api/init-interview")
async def init_interview(
    job_title: str = Form(...),
    job_description: str = Form(...),
    resume: UploadFile = File(...)
):
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

规则：
1. 每次只问一个问题
2. 紧扣技能和简历
3. 不说废话
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "开始面试"}
    ]

    first_question = call_mimo_api(messages)
    messages.append({"role": "assistant", "content": first_question})

    session_id = str(uuid.uuid4())
    session_data = {
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
async def chat(request: ChatRequest):
    key = f"session:{request.session_id}"
    data_str = redis_client.get(key)

    if not data_str:
        raise HTTPException(404, "session不存在")

    session = json.loads(data_str)

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
async def evaluate(request: EvaluateRequest):
    key = f"session:{request.session_id}"
    data_str = redis_client.get(key)

    if not data_str:
        raise HTTPException(404, "session不存在")

    session = json.loads(data_str)

    eval_prompt = build_evaluate_prompt(session)

    messages = [{"role": "user", "content": eval_prompt}]
    raw = call_mimo_api(messages, max_tokens=2200, temperature=0.1, force_json=True)

    print("原始返回:", raw)

    report = robust_json_parse(raw, messages)

    return {
        "code": 200,
        "data": report
    }
