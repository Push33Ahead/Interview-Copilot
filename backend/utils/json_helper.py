"""JSON 处理工具"""

import json
import re
from typing import Any, Dict, List, Optional


def extract_json(text: str) -> str:
    """从文本中提取干净的 JSON 字符串"""
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


def safe_json_load(text: str) -> Optional[Any]:
    """安全解析 JSON"""
    try:
        return json.loads(text)
    except Exception:
        return None


def normalize_report(data: Dict[str, Any]) -> Dict[str, Any]:
    """修正模型输出结构，避免前端因字段缺失崩溃"""
    if not isinstance(data, dict):
        raise ValueError("报告不是JSON对象")
    
    # 处理分数
    score = data.get("score", 0)
    try:
        score = int(float(score))
    except Exception:
        score = 0
    score = max(0, min(100, score))
    
    # 处理总结
    overall_summary = data.get("overall_summary", "")
    if not isinstance(overall_summary, str):
        overall_summary = str(overall_summary)
    
    # 处理答案改进建议
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
    
    # 处理简历优化建议
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
