"""面试相关路由"""

from typing import Optional
from fastapi import APIRouter, Header, UploadFile, File, Form

from models.schemas import ChatRequest, EvaluateRequest, InterviewType
from services.interview_service import interview_service
from core.security import get_current_user_from_auth_header

router = APIRouter(prefix="/api", tags=["面试"])


@router.post("/init-interview")
async def init_interview(
    # 面试类型
    interview_type: str = Form(..., description="面试类型: enterprise 或 postgraduate"),
    resume: UploadFile = File(...),
    # 企业面试字段（可选，但企业面试时必填）
    company_name: str = Form("", description="企业名称"),
    job_title: str = Form("", description="岗位名称"),
    job_description: str = Form("", description="岗位JD"),
    # 考研面试字段（可选，但考研面试时必填）
    school_name: str = Form("", description="学校名称"),
    major_name: str = Form("", description="专业名称"),
    authorization: str = Header(None)
):
    """初始化面试
    
    - interview_type: enterprise(企业面试) 或 postgraduate(考研面试)
    - 企业面试需要：company_name, job_title, job_description
    - 考研面试需要：school_name, major_name
    """
    user = get_current_user_from_auth_header(authorization)
    
    # 解析面试类型
    try:
        interview_type_enum = InterviewType(interview_type)
    except ValueError:
        return {"code": 400, "message": "无效的面试类型，请使用 enterprise 或 postgraduate"}
    
    # 根据类型验证必填字段
    if interview_type_enum == InterviewType.ENTERPRISE:
        if not company_name or not company_name.strip():
            return {"code": 400, "message": "企业面试需要提供企业名称"}
        if not job_title or not job_title.strip():
            return {"code": 400, "message": "企业面试需要提供岗位名称"}
        if not job_description or not job_description.strip():
            return {"code": 400, "message": "企业面试需要提供岗位描述（JD）"}
    else:  # POSTGRADUATE
        if not school_name or not school_name.strip():
            return {"code": 400, "message": "考研面试需要提供学校名称"}
        if not major_name or not major_name.strip():
            return {"code": 400, "message": "考研面试需要提供专业名称"}
    
    result = await interview_service.create_session(
        interview_type=interview_type_enum,
        resume=resume,
        user_email=user["email"],
        company_name=company_name,
        job_title=job_title,
        job_description=job_description,
        school_name=school_name,
        major_name=major_name
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
