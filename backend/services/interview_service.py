"""面试业务服务"""

import json
import uuid
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, UploadFile

from config.constants import (
    SESSION_TTL_SECONDS, REPORT_TTL_SECONDS, MAX_INTERVIEW_TURNS
)
from core.redis_client import (
    redis_client, make_session_key, make_user_reports_key, make_report_detail_key
)
from core.security import now_iso
from utils.pdf_parser import parse_pdf_content
from services.ai_service import ai_service


class InterviewService:
    """面试服务类"""
    
    async def create_session(
        self,
        job_title: str,
        job_description: str,
        resume: UploadFile,
        user_email: str
    ) -> Dict[str, str]:
        """创建面试会话"""
        if not resume.filename.endswith(".pdf"):
            raise HTTPException(status_code=400, detail="只接受PDF")
        
        pdf_bytes = await resume.read()
        resume_text = parse_pdf_content(pdf_bytes)
        
        # 生成第一个问题
        first_question = ai_service.generate_first_question(
            job_title, job_description, resume_text
        )
        
        # 构建消息历史
        system_prompt = f"""你是资深{job_title}面试官。
岗位需求:
{job_description}

候选人简历:
{resume_text}

规则：1. 每次只问一个问题 2. 紧扣技能和简历 3. 不说废话
"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "开始面试"},
            {"role": "assistant", "content": first_question}
        ]
        
        # 保存会话
        session_id = str(uuid.uuid4())
        session_data = {
            "owner_email": user_email,
            "job_title": job_title,
            "job_description": job_description,
            "resume_text": resume_text,
            "turn_count": 1,
            "messages": messages
        }
        
        redis_client.setex(
            make_session_key(session_id),
            SESSION_TTL_SECONDS,
            json.dumps(session_data, ensure_ascii=False)
        )
        
        return {
            "session_id": session_id,
            "first_question": first_question
        }
    
    def get_session(self, session_id: str, user_email: str) -> Dict[str, Any]:
        """获取会话并验证权限"""
        key = make_session_key(session_id)
        data_str = redis_client.get(key)
        
        if not data_str:
            raise HTTPException(status_code=404, detail="session不存在")
        
        session = json.loads(data_str)
        owner_email = session.get("owner_email", "")
        
        if owner_email and owner_email != user_email:
            raise HTTPException(status_code=403, detail="无权访问该面试会话")
        
        if not owner_email:
            session["owner_email"] = user_email
        
        return session, key
    
    def chat(
        self,
        session_id: str,
        user_answer: str,
        user_email: str
    ) -> Dict[str, Any]:
        """面试对话"""
        session, key = self.get_session(session_id, user_email)
        
        # 添加用户回答
        session["messages"].append({"role": "user", "content": user_answer})
        
        # 检查回合数
        if session["turn_count"] >= MAX_INTERVIEW_TURNS:
            return {
                "next_question": "面试结束",
                "is_finished": True
            }
        
        # 获取下一个问题
        next_q = ai_service.call_api(session["messages"])
        session["messages"].append({"role": "assistant", "content": next_q})
        session["turn_count"] += 1
        
        # 保存会话
        redis_client.setex(key, SESSION_TTL_SECONDS, json.dumps(session, ensure_ascii=False))
        
        return {
            "next_question": next_q,
            "turn_count": session["turn_count"],
            "is_finished": False
        }
    
    def evaluate(self, session_id: str, user_email: str) -> Dict[str, Any]:
        """评估面试"""
        session, key = self.get_session(session_id, user_email)
        
        # 构建评估提示
        eval_prompt = ai_service.build_evaluate_prompt(session)
        messages = [{"role": "user", "content": eval_prompt}]
        
        # 调用模型
        raw = ai_service.call_api(messages, max_tokens=2200, temperature=0.1, force_json=True)
        print("原始返回:", raw)
        
        # 解析报告
        try:
            report = ai_service.parse_with_retry(raw, messages)
        except HTTPException as e:
            detail_text = e.detail if isinstance(e.detail, str) else str(e.detail)
            raise HTTPException(
                status_code=e.status_code,
                detail={
                    "message": detail_text,
                    "raw_model_output": str(raw)[:8000]
                }
            )
        
        # 保存报告
        report_id = str(uuid.uuid4())
        now = now_iso()
        report_summary = {
            "id": report_id,
            "score": report.get("score", 0),
            "overall_summary": report.get("overall_summary", ""),
            "job_title": session.get("job_title", ""),
            "created_at": now
        }
        report_detail = {
            "id": report_id,
            "created_at": now,
            "job_title": report_summary["job_title"],
            "report": report
        }
        
        user_reports_key = make_user_reports_key(user_email)
        redis_client.lpush(user_reports_key, json.dumps(report_summary, ensure_ascii=False))
        redis_client.ltrim(user_reports_key, 0, 99)
        redis_client.setex(
            make_report_detail_key(report_id),
            REPORT_TTL_SECONDS,
            json.dumps(report_detail, ensure_ascii=False)
        )
        
        return {
            "report": report,
            "report_id": report_id,
            "raw_model_output": str(raw)[:8000]
        }
    
    def list_reports(self, user_email: str) -> List[Dict[str, Any]]:
        """获取用户报告列表"""
        report_items = redis_client.lrange(make_user_reports_key(user_email), 0, 99)
        reports = []
        for item in report_items:
            try:
                parsed = json.loads(item)
                if isinstance(parsed, dict):
                    reports.append(parsed)
            except Exception:
                continue
        return reports
    
    def get_report_detail(self, report_id: str, user_email: str) -> Dict[str, Any]:
        """获取报告详情"""
        report_raw = redis_client.get(make_report_detail_key(report_id))
        if not report_raw:
            raise HTTPException(status_code=404, detail="评估记录不存在或已过期")
        
        # 验证所有权
        reports_raw = redis_client.lrange(make_user_reports_key(user_email), 0, 200)
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
        
        return json.loads(report_raw)
    
    def delete_report(self, report_id: str, user_email: str) -> bool:
        """删除报告"""
        user_reports_key = make_user_reports_key(user_email)
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
        return True


# 全局面试服务实例
interview_service = InterviewService()
