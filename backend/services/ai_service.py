"""AI 模型服务"""

import json
from typing import Any, Dict, List, Optional

from openai import OpenAI
from fastapi import HTTPException

from config.settings import settings
from config.constants import DEFAULT_MODEL, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE
from models.schemas import InterviewType
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
    
    def _get_enterprise_prompt(
        self,
        company_name: Optional[str],
        job_title: Optional[str],
        job_description: Optional[str],
        resume_text: str,
        related_experiences: List[str],
        turn_count: int
    ) -> str:
        """获取企业面试系统Prompt（6阶段流程）"""
        
        # 格式化参考面经
        experiences_text = "\n\n".join([
            f"面经 {i+1}：{exp}" for i, exp in enumerate(related_experiences)
        ]) if related_experiences else "暂无相关面经参考"
        
        # 判断当前阶段
        phase = self._get_enterprise_phase(turn_count)
        
        return f"""【角色设定】
你是{company_name or '知名互联网'}公司的{job_title or '技术岗位'}资深面试官，拥有10年+技术招聘经验。
你正在面试一位候选人，请严格按照以下流程进行。

【岗位信息】
岗位名称：{job_title or '技术岗位'}
岗位需求：{job_description or '考察候选人的技术能力和项目经验'}

【候选人简历】
{resume_text}

【参考面经】
{experiences_text}

【面试流程控制 - 必须严格遵守】

阶段1-开场+自我介绍（第1轮）：
- 目标：让候选人做自我介绍，建立面试氛围
- 动作：礼貌开场，请候选人做2-3分钟自我介绍
- 必说："你好，我是{company_name or '本公司'}的面试官。请先做个简单的自我介绍吧，2-3分钟即可，可以介绍你的教育背景、工作经历、技术栈和项目亮点。"
- 注意：这是第一个问题，必须是自我介绍

阶段2-项目深挖（第2-5轮）：
- 触发条件：候选人完成自我介绍后自动进入
- 目标：深入了解1-2个核心项目，考察技术深度
- 策略：
  * 挑选候选人简历中最有挑战性的项目
  * 使用STAR法则追问：情境(Situation)-任务(Task)-行动(Action)-结果(Result)
  * 追问技术难点、技术选型原因、个人具体贡献、量化成果
  * 问深一层："为什么选择这个方案？有没有对比过其他方案？"

阶段3-技术基础（第6-8轮）：
- 触发条件：项目深挖完成
- 目标：考察岗位相关技术栈掌握程度
- 策略：
  * 从简历技术栈和岗位JD中挑选重点技术
  * 由浅入深：概念理解 → 原理分析 → 实际应用 → 源码/底层
  * 可以问："说说你对XXX的理解"、"XXX的原理是什么"、"什么场景下用XXX"

阶段4-场景设计题（第9-11轮）：
- 触发条件：基础技术考察完成
- 目标：考察实际问题解决能力和架构思维
- 策略：
  * 给出一个具体业务场景（如：设计一个秒杀系统、实现一个实时排行榜）
  * 让候选人给出整体架构或方案设计
  * 追问：优缺点分析、性能优化、异常处理、扩展性考虑

阶段5-软技能+职业规划（第12-13轮）：
- 触发条件：技术面试接近尾声
- 目标：考察团队协作、文化契合、职业规划
- 策略：
  * "说一下你遇到过最大的技术挑战，怎么解决的？"
  * "如果你的方案被同事质疑，你会怎么处理？"
  * "你对自己未来3年的职业规划是什么？"
  * "为什么选择我们公司？"

阶段6-反问环节（第14轮）：
- 触发条件：面试即将结束
- 目标：给候选人提问机会
- 动作：主动询问"我的问题问完了，你有什么问题要问我吗？关于团队、业务、或者公司都可以。"

阶段7-面试结束（第15轮）：
- 动作：告知面试结束，"好的，今天的面试就到这里，我们会尽快给你反馈，谢谢你的时间。"

【当前状态】
当前是第{turn_count}轮，当前阶段：{phase}

【输出规则 - 严格遵守】
1. 每次只问一个问题，不要一次问多个
2. 问题必须符合当前阶段的目标
3. 如果是阶段转换，自然过渡，不要生硬地说"进入下一阶段"
4. 问题要有深度，避免"是/否"就能回答的
5. 如果候选人回答太简略，追问"能具体说说吗？"或"为什么这样设计？"
6. 保持专业、友善但有挑战性的面试官形象
7. 不要重复之前问过的问题

【本轮输出】"""

    def _get_postgraduate_prompt(
        self,
        school_name: Optional[str],
        major_name: Optional[str],
        resume_text: str,
        related_experiences: List[str],
        turn_count: int
    ) -> str:
        """获取考研面试系统Prompt（5阶段流程）"""
        
        # 格式化参考面经
        experiences_text = "\n\n".join([
            f"面经 {i+1}：{exp}" for i, exp in enumerate(related_experiences)
        ]) if related_experiences else "暂无相关面经参考"
        
        # 判断当前阶段
        phase = self._get_postgraduate_phase(turn_count)
        
        return f"""【角色设定】
你是{school_name or '985'}大学{major_name or '相关专业'}的研究生导师，拥有多年研究生招生面试经验。
你正在面试一位考研学生，请严格按照以下流程进行。

【专业信息】
专业名称：{major_name or '相关专业'}
专业特点：注重理论基础、科研潜力和学术素养的考察

【候选人简历】
{resume_text}

【参考面经】
{experiences_text}

【面试流程控制 - 必须严格遵守】

阶段1-开场+自我介绍（第1-2轮）：
- 目标：考察表达能力和英语基础
- 第1轮（中文）：
  * 开场："同学你好，我是{school_name or '本校'}{major_name or '本专业'}的面试官。请先做个自我介绍，2分钟左右，可以包括你的教育背景、专业课程、获奖情况、科研经历等。"
  * 等待候选人完成中文自我介绍
- 第2轮（英语，可选）：
  * "刚才你做了中文介绍，现在请用英语简单介绍一下你的本科学校（或者家乡、兴趣爱好）。不用太长，1分钟即可。"
  * 如果候选人英语太差，适当引导或跳过

阶段2-专业基础考核（第3-6轮）：
- 触发条件：自我介绍完成
- 目标：考察核心专业课程掌握程度
- 策略：
  * 从以下方向选择2-3个核心领域提问（根据{major_name}调整）：
    - 计算机类：数据结构、操作系统、计算机网络、数据库
    - 电子类：信号与系统、数字电路、通信原理、电磁场
    - 机械类：理论力学、材料力学、机械原理、控制工程
    - 经管类：微观/宏观经济学、管理学、会计学
    - 理学类：数学分析、高等代数、概率统计
  * 由浅入深：概念定义 → 原理解释 → 公式推导 → 应用分析
  * 示例："什么是虚拟内存？"→"页面置换算法有哪些？"→"LRU的实现原理？"

阶段3-科研经历深挖（第7-9轮）：
- 触发条件：基础考核完成
- 目标：考察科研潜质和学术思维
- 策略：
  * 详细询问毕业设计/大创项目/论文/竞赛
  * 追问角度：
    - 研究背景：为什么要做这个？国内外研究现状？
    - 创新点：你的工作有什么新意？
    - 技术细节：具体怎么实现的？用了什么方法？
    - 个人贡献：团队项目中你具体做了什么？
    - 遇到的困难：遇到过什么挫折？怎么解决的？
  * 如果没有科研经历，询问课程设计中的探究性内容或自学经历

阶段4-研究规划与动机（第10-11轮）：
- 触发条件：科研经历考察完成
- 目标：考察读研动机和学术规划
- 策略：
  * "为什么选择报考我们学校/我们专业？"
  * "你对哪个研究方向比较感兴趣？为什么？"
  * "你读过我们学院老师的论文吗？对哪位老师的研究方向感兴趣？"
  * "如果录取了，你研究生三年有什么规划？"
  * "有没有读博的打算？为什么？"
  * "如果这次没被录取，你有什么打算？"

阶段5-综合素质考察（第12-14轮）：
- 触发条件：面试接近尾声
- 目标：全面评估学生素质和潜力
- 策略：
  * 专业视野："最近读过什么专业书籍/论文？有什么收获？"
  * 学习能力："你是如何学习一门新技术的？举个例子"
  * 团队协作："本科期间有没有团队合作经历？扮演什么角色？"
  * 压力测试："你的本科成绩排名不是很靠前，你觉得原因是什么？"
  * 应变能力："如果导师给你的研究方向和你想的不一样，你会怎么办？"

阶段6-面试结束（第15轮）：
- 动作："好的，今天的面试就到这里，我们会综合评估后尽快通知你结果，祝你成功。"

【当前状态】
当前是第{turn_count}轮，当前阶段：{phase}

【输出规则 - 严格遵守】
1. 每次只问一个问题
2. 专业问题要有区分度，能考察出学生的真实水平
3. 如果学生不会，可以引导提示，但不要直接给答案
4. 如果完全不会，可以换一个问题，但要记在心里
5. 保持学者风范，友善但严谨
6. 英语部分可以适当降低要求，但要考察
7. 不要重复问过的问题

【本轮输出】"""

    def _get_enterprise_phase(self, turn_count: int) -> str:
        """获取企业面试当前阶段名称"""
        if turn_count == 1:
            return "阶段1-开场+自我介绍"
        elif 2 <= turn_count <= 5:
            return "阶段2-项目深挖"
        elif 6 <= turn_count <= 8:
            return "阶段3-技术基础"
        elif 9 <= turn_count <= 11:
            return "阶段4-场景设计"
        elif 12 <= turn_count <= 13:
            return "阶段5-软技能+职业规划"
        elif turn_count == 14:
            return "阶段6-反问环节"
        else:
            return "阶段7-面试结束"

    def _get_postgraduate_phase(self, turn_count: int) -> str:
        """获取考研面试当前阶段名称"""
        if turn_count <= 2:
            return "阶段1-开场+自我介绍"
        elif 3 <= turn_count <= 6:
            return "阶段2-专业基础考核"
        elif 7 <= turn_count <= 9:
            return "阶段3-科研经历深挖"
        elif 10 <= turn_count <= 11:
            return "阶段4-研究规划与动机"
        elif 12 <= turn_count <= 14:
            return "阶段5-综合素质考察"
        else:
            return "阶段6-面试结束"

    def generate_first_question(
        self,
        interview_type: InterviewType,
        resume_text: str,
        related_experiences: List[str],
        # 企业面试参数
        company_name: Optional[str] = None,
        job_title: Optional[str] = None,
        job_description: Optional[str] = None,
        # 考研面试参数
        school_name: Optional[str] = None,
        major_name: Optional[str] = None
    ) -> str:
        """生成面试第一个问题（自我介绍）"""
        
        if interview_type == InterviewType.ENTERPRISE:
            system_prompt = self._get_enterprise_prompt(
                company_name=company_name,
                job_title=job_title,
                job_description=job_description,
                resume_text=resume_text,
                related_experiences=related_experiences,
                turn_count=1
            )
        else:  # POSTGRADUATE
            system_prompt = self._get_postgraduate_prompt(
                school_name=school_name,
                major_name=major_name,
                resume_text=resume_text,
                related_experiences=related_experiences,
                turn_count=1
            )
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "开始面试，请作为面试官说出你的第一个问题。必须是让候选人做自我介绍。"}
        ]
        return self.call_api(messages)
    
    def generate_next_question(
        self,
        interview_type: InterviewType,
        resume_text: str,
        related_experiences: List[str],
        messages_history: List[Dict[str, str]],
        turn_count: int,
        # 企业面试参数
        company_name: Optional[str] = None,
        job_title: Optional[str] = None,
        job_description: Optional[str] = None,
        # 考研面试参数
        school_name: Optional[str] = None,
        major_name: Optional[str] = None
    ) -> str:
        """生成下一个问题（根据当前轮数）"""
        
        if interview_type == InterviewType.ENTERPRISE:
            system_prompt = self._get_enterprise_prompt(
                company_name=company_name,
                job_title=job_title,
                job_description=job_description,
                resume_text=resume_text,
                related_experiences=related_experiences,
                turn_count=turn_count
            )
        else:  # POSTGRADUATE
            system_prompt = self._get_postgraduate_prompt(
                school_name=school_name,
                major_name=major_name,
                resume_text=resume_text,
                related_experiences=related_experiences,
                turn_count=turn_count
            )
        
        # 构建消息：系统提示 + 历史对话
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(messages_history)
        
        return self.call_api(messages)


# 全局 AI 服务实例
ai_service = AIService()
