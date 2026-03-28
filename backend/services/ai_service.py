"""AI 模型服务"""

import json
from typing import Any, Dict, List

from openai import OpenAI
from fastapi import HTTPException

from config.settings import settings
from config.constants import DEFAULT_MODEL, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE
from utils.json_helper import extract_json, safe_json_load, normalize_report


class AIService:
    """AI 服务类"""
    
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL
        )
    
    def call_api(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = DEFAULT_MAX_TOKENS,
        temperature: float = DEFAULT_TEMPERATURE,
        force_json: bool = False
    ) -> str:
        """调用大模型 API"""
        payload = {
            "model": DEFAULT_MODEL,
            "messages": messages,
            "max_completion_tokens": max_tokens,
            "temperature": temperature,
            "top_p": 0.95
        }
        if force_json:
            payload["response_format"] = {"type": "json_object"}
        
        try:
            completion = self.client.chat.completions.create(**payload)
            return completion.choices[0].message.content
        except Exception as e:
            # 兼容不支持 response_format 的第三方网关
            if force_json:
                try:
                    fallback_payload = dict(payload)
                    fallback_payload.pop("response_format", None)
                    completion = self.client.chat.completions.create(**fallback_payload)
                    return completion.choices[0].message.content
                except Exception:
                    pass
            print("API调用报错:", str(e))
            raise HTTPException(status_code=500, detail="大模型接口异常")
    
    def parse_with_retry(
        self,
        raw_text: str,
        messages: List[Dict[str, str]],
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """带重试的 JSON 解析"""
        last_error = "未知错误"
        
        for i in range(max_retries):
            try:
                cleaned = extract_json(raw_text)
                data = safe_json_load(cleaned)
                if data:
                    return normalize_report(data)
                last_error = "json.loads 返回空"
            except Exception as e:
                last_error = str(e)
            
            print(f"解析失败，第{i+1}次重试，原因: {last_error}")
            
            # 构造修复提示
            repair_messages = messages + [
                {"role": "assistant", "content": str(raw_text)},
                {"role": "user", "content": (
                    "你上一次输出无法解析。请只返回一个合法JSON对象，不要Markdown，不要解释，不要代码块。"
                    "必须包含键：score, overall_summary, answer_improvements, resume_optimizations。"
                )}
            ]
            raw_text = self.call_api(repair_messages, max_tokens=2200, temperature=0.1, force_json=True)
        
        raise HTTPException(status_code=500, detail=f"JSON解析失败（模型输出不稳定）：{last_error}")
    
    def build_evaluate_prompt(self, session: Dict[str, Any]) -> str:
        """构建评估提示词"""
        resume_text = (session.get("resume_text") or "")[:6000]
        dialog = [m for m in session.get("messages", []) if m.get("role") in ("user", "assistant")]
        # 仅保留最近 24 条
        dialog = dialog[-24:]
        chat_str = json.dumps(dialog, ensure_ascii=False)
        
        return f"""你不是聊天助手，你是一个 API。必须返回严格 JSON，不允许任何解释。不要输出 Markdown，不要输出代码块。
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
    
    def generate_first_question(
        self,
        job_title: str,
        job_description: str,
        resume_text: str
    ) -> str:
        """生成面试第一个问题"""
        system_prompt = f"""你是资深{job_title}面试官。
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
        return self.call_api(messages)


# 全局 AI 服务实例
ai_service = AIService()
