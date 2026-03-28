"""面试相关路由"""

from fastapi import APIRouter, Header, UploadFile, File, Form

from models.schemas import ChatRequest, EvaluateRequest
from services.interview_service import interview_service
from core.security import get_current_user_from_auth_header

router = APIRouter(prefix="/api", tags=["面试"])


@router.post("/init-interview")
async def init_interview(
    job_title: str = Form(...),
    job_description: str = Form(...),
    resume: UploadFile = File(...),
    authorization: str = Header(None)
):
    """初始化面试"""
    user = get_current_user_from_auth_header(authorization)
    result = await interview_service.create_session(
        job_title=job_title,
        job_description=job_description,
        resume=resume,
        user_email=user["email"]
    )
    return {"code": 200, "data": result}


@router.post("/chat")
async def chat(request: ChatRequest, authorization: str = Header(None)):
    """面试对话"""
    user = get_current_user_from_auth_header(authorization)
    result = interview_service.chat(
        session_id=request.session_id,
        user_answer=request.user_answer,
        user_email=user["email"]
    )
    return {"code": 200, "data": result}


@router.post("/evaluate")
async def evaluate(request: EvaluateRequest, authorization: str = Header(None)):
    """评估面试"""
    user = get_current_user_from_auth_header(authorization)
    result = interview_service.evaluate(request.session_id, user["email"])
    return {
        "code": 200,
        "data": result["report"],
        "meta": {"report_id": result["report_id"]},
        "debug": {"raw_model_output": result["raw_model_output"]}
    }


@router.get("/reports")
async def list_reports(authorization: str = Header(None)):
    """获取报告列表"""
    user = get_current_user_from_auth_header(authorization)
    reports = interview_service.list_reports(user["email"])
    return {"code": 200, "data": reports}


@router.get("/reports/{report_id}")
async def get_report_detail(report_id: str, authorization: str = Header(None)):
    """获取报告详情"""
    user = get_current_user_from_auth_header(authorization)
    report = interview_service.get_report_detail(report_id, user["email"])
    return {"code": 200, "data": report}


@router.delete("/reports/{report_id}")
async def delete_report(report_id: str, authorization: str = Header(None)):
    """删除报告"""
    user = get_current_user_from_auth_header(authorization)
    interview_service.delete_report(report_id, user["email"])
    return {"code": 200, "data": True}
