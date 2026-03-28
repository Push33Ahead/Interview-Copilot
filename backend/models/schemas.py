"""Pydantic 数据模型"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


# ========== 认证相关 ==========

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


# ========== 面试相关 ==========

class ChatRequest(BaseModel):
    session_id: str
    user_answer: str


class EvaluateRequest(BaseModel):
    session_id: str


# ========== 面经广场相关 ==========

class PostCreateRequest(BaseModel):
    company: str
    role: str
    content: str
    tags: List[str] = []


class CommentCreateRequest(BaseModel):
    content: str
    reply_to: str = ""
    reply_to_name: str = ""


# ========== 报告相关 ==========

class ReportSummary(BaseModel):
    id: str
    score: int
    overall_summary: str
    job_title: str
    created_at: str


class ReportDetail(BaseModel):
    id: str
    created_at: str
    job_title: str
    report: Dict[str, Any]


class AnswerImprovement(BaseModel):
    question: str
    user_answer: str
    suggestion: str
    good_example: str


class EvaluationReport(BaseModel):
    score: int
    overall_summary: str
    answer_improvements: List[AnswerImprovement]
    resume_optimizations: List[str]
