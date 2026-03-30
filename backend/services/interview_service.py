"""面试业务服务"""

import json
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, UploadFile

from config.constants import (
    SESSION_TTL_SECONDS, REPORT_TTL_SECONDS, MAX_INTERVIEW_TURNS
)
from models.schemas import InterviewType
from core.redis_client import (
    redis_client, make_session_key, make_user_reports_key, make_report_detail_key
)
from core.security import now_iso
from utils.pdf_parser import parse_pdf_content
from services.ai_service import ai_service
from services.post_service import post_service


class InterviewService:
    """面试服务类"""
    
    async def create_session(
        self,
        interview_type: InterviewType,
        resume: UploadFile,
        user_email: str,
        # 企业面试参数
        company_name: Optional[str] = None,
        job_title: Optional[str] = None,
        job_description: Optional[str] = None,
        # 考研面试参数
        school_name: Optional[str] = None,
        major_name: Optional[str] = None
    ) -> Dict[str, str]:
        """创建面试会话"""
        if not resume.filename.endswith(".pdf"):
            raise HTTPException(status_code=400, detail="只接受PDF")
        
        pdf_bytes = await resume.read()
        resume_text = parse_pdf_content(pdf_bytes)
        
        # 搜索相关面经
        related_experiences = self._search_related_experiences(
            interview_type=interview_type,
            company_name=company_name,
            job_title=job_title,
            school_name=school_name,
            major_name=major_name
        )
        
        # 生成第一个问题（内部包含完整的系统Prompt）
        first_question = ai_service.generate_first_question(
            interview_type=interview_type,
            resume_text=resume_text,
            related_experiences=related_experiences,
            company_name=company_name,
            job_title=job_title,
            job_description=job_description,
            school_name=school_name,
            major_name=major_name
        )
        
        # 构建消息历史（从第二轮开始，系统Prompt会在generate_next_question中动态添加）
        messages = [
            {"role": "user", "content": "开始面试"},
            {"role": "assistant", "content": first_question}
        ]
        
        # 保存会话
        session_id = str(uuid.uuid4())
        session_data = {
            "owner_email": user_email,
            "interview_type": interview_type.value,
            "resume_text": resume_text,
            "related_experiences": related_experiences,
            "turn_count": 1,
            "messages": messages
        }
        
        # 根据类型保存特定字段
        if interview_type == InterviewType.ENTERPRISE:
            session_data.update({
                "company_name": company_name,
                "job_title": job_title,
                "job_description": job_description
            })
        else:  # POSTGRADUATE
            session_data.update({
                "school_name": school_name,
                "major_name": major_name
            })
        
        redis_client.setex(
            make_session_key(session_id),
            SESSION_TTL_SECONDS,
            json.dumps(session_data, ensure_ascii=False)
        )
        
        return {
            "session_id": session_id,
            "first_question": first_question,
            "interview_type": interview_type.value
        }
    
    def _search_related_experiences(
        self,
        interview_type: InterviewType,
        company_name: Optional[str] = None,
        job_title: Optional[str] = None,
        school_name: Optional[str] = None,
        major_name: Optional[str] = None,
        limit: int = 3
    ) -> List[str]:
        """搜索相关面试经历"""
        experiences = []
        
        if interview_type == InterviewType.ENTERPRISE:
            # 企业面试：搜索公司和岗位相关的面经
            search_query = " ".join(filter(None, [company_name, job_title]))
        else:
            # 考研面试：搜索学校和专业相关的面经
            search_query = " ".join(filter(None, [school_name, major_name]))
        
        if not search_query.strip():
            return experiences
        
        try:
            # 从面经广场搜索
            posts = post_service.search_posts(query=search_query, limit=limit * 2)
            
            # 提取内容（优先选择有标签匹配的）
            for post in posts[:limit]:
                content = post.get("content", "").strip()
                if content:
                    # 截取前500字符作为参考
                    experiences.append(content[:500])
        except Exception as e:
            print(f"搜索相关面经历失败: {e}")
        
        return experiences
    
    def get_session(self, session_id: str, user_email: str) -> Tuple[Dict[str, Any], str]:
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
        
        # 获取面试类型和相关信息
        interview_type = InterviewType(session.get("interview_type", "enterprise"))
        turn_count = session["turn_count"] + 1  # 下一轮
        
        # 获取相关信息
        related_experiences = session.get("related_experiences", [])
        resume_text = session.get("resume_text", "")
        
        # 获取企业/考研特定信息
        company_name = session.get("company_name")
        job_title = session.get("job_title")
        job_description = session.get("job_description")
        school_name = session.get("school_name")
        major_name = session.get("major_name")
        
        # 使用新的方法生成问题（带阶段控制）
        next_q = ai_service.generate_next_question(
            interview_type=interview_type,
            resume_text=resume_text,
            related_experiences=related_experiences,
            messages_history=session["messages"],
            turn_count=turn_count,
            company_name=company_name,
            job_title=job_title,
            job_description=job_description,
            school_name=school_name,
            major_name=major_name
        )
        
        session["messages"].append({"role": "assistant", "content": next_q})
        session["turn_count"] = turn_count
        
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
        eval_prompt = self._build_evaluate_prompt(session)
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
        
        # 获取显示标题
        interview_type = session.get("interview_type", "enterprise")
        if interview_type == "enterprise":
            display_title = f"{session.get('company_name', '')} - {session.get('job_title', '')}"
        else:
            display_title = f"{session.get('school_name', '')} - {session.get('major_name', '')}"
        
        report_summary = {
            "id": report_id,
            "score": report.get("score", 0),
            "overall_summary": report.get("overall_summary", ""),
            "job_title": display_title,
            "interview_type": interview_type,
            "created_at": now
        }
        report_detail = {
            "id": report_id,
            "created_at": now,
            "job_title": display_title,
            "interview_type": interview_type,
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
    
    def _build_evaluate_prompt(self, session: Dict[str, Any]) -> str:
        """构建评估提示词（优化版，按面试阶段评估）"""
        resume_text = (session.get("resume_text") or "")[:6000]
        dialog = [m for m in session.get("messages", []) if m.get("role") in ("user", "assistant")]
        dialog = dialog[-24:]  # 仅保留最近 24 条
        chat_str = json.dumps(dialog, ensure_ascii=False)
        
        interview_type = session.get("interview_type", "enterprise")
        
        if interview_type == "enterprise":
            context_info = f"""面试类型：企业技术面试
公司：{session.get('company_name', '')}
岗位：{session.get('job_title', '')}
岗位需求：{(session.get('job_description') or '')[:3000]}"""
            
            focus_points = """【企业面试评估维度 - 按阶段】

阶段1-自我介绍（第1轮）：
- 评估：表达清晰度、逻辑性、重点突出程度
- 优秀标准：2-3分钟，涵盖教育背景、核心技能、项目亮点、求职意向

阶段2-项目深挖（第2-5轮）：
- 评估：项目真实性、技术深度、个人贡献度
- 优秀标准：能清晰描述技术难点、解决方案、量化结果；对技术选型有合理思考

阶段3-技术基础（第6-8轮）：
- 评估：技术栈掌握程度、知识体系完整性
- 优秀标准：概念理解准确，能深入原理，有实际应用经验

阶段4-场景设计（第9-11轮）：
- 评估：架构思维、问题解决能力、全面性
- 优秀标准：能给出合理方案，考虑扩展性、性能、异常处理

阶段5-软技能（第12-13轮）：
- 评估：沟通能力、团队协作、职业规划
- 优秀标准：表达清晰，有团队意识，职业规划明确且合理

阶段6-反问（第14轮）：
- 评估：思考深度、对岗位/公司的兴趣度
- 优秀标准：问出有质量的问题，展现对职位的思考"""

            score_guide = """【企业面试打分指南】
90-100分：优秀，技术扎实，项目经验丰富，沟通表达出色，强烈推荐
80-89分：良好，技术能力达标，有一定项目经验，可以胜任岗位
70-79分：一般，技术基础尚可，但项目经验或沟通有欠缺，需要培养
60-69分：及格，勉强达到最低要求，有明显短板，慎重考虑
60分以下：不及格，技术能力或沟通能力严重不足，不推荐"""

        else:  # POSTGRADUATE
            context_info = f"""面试类型：考研复试
学校：{session.get('school_name', '')}
专业：{session.get('major_name', '')}"""
            
            focus_points = """【考研面试评估维度 - 按阶段】

阶段1-自我介绍（第1-2轮）：
- 评估：表达能力、英语基础、逻辑性
- 优秀标准：中文自我介绍完整清晰；英语表达流畅，发音可接受

阶段2-专业基础（第3-6轮）：
- 评估：核心课程掌握程度、知识体系的完整性
- 优秀标准：概念理解准确，能推导原理，有深入思考

阶段3-科研经历（第7-9轮）：
- 评估：科研潜质、学术思维、问题解决能力
- 优秀标准：能清晰阐述研究背景、方法、创新点；对困难有反思

阶段4-研究规划（第10-11轮）：
- 评估：读研动机、学术兴趣、规划能力
- 优秀标准：对专业有了解，研究方向明确，有清晰的研究生规划

阶段5-综合素质（第12-14轮）：
- 评估：学习能力、心理素质、团队协作
- 优秀标准：有自学能力，心理素质好，有团队合作经历"""

            score_guide = """【考研面试打分指南】
90-100分：优秀，专业基础扎实，科研潜力强，英语良好，强烈推荐录取
80-89分：良好，专业基础较好，有一定科研潜力，可以录取
70-79分：一般，专业基础尚可，但科研潜力或英语有欠缺，建议候补
60-69分：及格，勉强达到最低要求，有明显短板，慎重录取
60分以下：不及格，专业基础或综合素质严重不足，不建议录取"""
        
        return f"""你不是聊天助手，你是一个专业的面试评估师。请对以下面试进行客观、详细的评估。
必须返回严格 JSON，不允许任何解释。不要输出 Markdown，不要输出代码块。

{context_info}

候选人简历：
{resume_text}

完整面试对话：
{chat_str}

{focus_points}

{score_guide}

【评估要求】
1. 仔细回顾每一轮对话，评估候选人在每个阶段的表现
2. 对于回答不好的问题，给出具体的改进建议和优秀回答示例
3. 分析简历的优缺点，给出优化建议
4. 给出综合评分（0-100分）和总体评价
5. 评分要客观公正，参照上面的打分指南

返回结构：{{
 "score": 85,
 "overall_summary": "总体评价：候选人技术基础扎实，项目经验丰富...",
 "stage_evaluations": {{
   "自我介绍": "表现：...",
   "项目深挖": "表现：...",
   "技术基础": "表现：...",
   "场景设计": "表现：...",
   "软技能": "表现：..."
 }},
 "answer_improvements":[
  {{
   "question":"具体的问题内容",
   "user_answer":"候选人的回答摘要",
   "suggestion":"具体的改进建议",
   "good_example":"优秀的回答示例，200字左右"
  }}
 ],
 "resume_optimizations":["简历优化建议1：...", "简历优化建议2：..."],
 "recommendation": "推荐/候补/不推荐"
}}
"""
    
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
