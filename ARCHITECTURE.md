# Interview Copilot 架构文档

> 本文档用于快速了解项目架构，建议在新对话开始时优先阅读。

---

## 一、项目概述

**Interview Copilot** 是一个 AI 驱动的技术面试模拟平台，帮助开发者通过 AI 面试官进行真实的技术面试演练。

### 核心功能
- 🤖 **AI 智能面试** - 基于简历和 JD 生成个性化面试问题
- 📝 **面经广场** - 分享和浏览面试经验
- 🔔 **通知系统** - 点赞、评论实时通知
- 👤 **用户系统** - 邮箱注册/登录、头像上传
- 📊 **评估报告** - 面试表现分析和改进建议

---

## 二、技术栈

### 前端
| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.x | React 框架 |
| React | 19.x | UI 库 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 4.x | 样式框架 |
| axios | 1.x | HTTP 客户端 |
| lucide-react | 1.x | 图标库 |

### 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.8 | 运行时 |
| FastAPI | 0.95+ | Web 框架 |
| Redis | 5.x | 数据存储 |
| OpenAI SDK | 1.x | AI 调用 |
| PyMuPDF | 1.22+ | PDF 解析 |

---

## 三、项目结构

```
Interview-Copilot/
├── app/                          # 前端 (Next.js App Router)
│   ├── (main)/                   # 主应用路由组
│   │   ├── layout.tsx            # 侧边栏布局
│   │   ├── start/page.tsx        # 开始面试页
│   │   ├── chat/page.tsx         # 面试对话页
│   │   ├── history/page.tsx      # 面试历史
│   │   ├── report/page.tsx       # 评估报告
│   │   └── square/               # 面经广场
│   │       ├── page.tsx          # 帖子列表
│   │       └── [id]/page.tsx     # 帖子详情
│   │
│   ├── login/page.tsx            # 登录页
│   ├── register/page.tsx         # 注册页
│   ├── page.tsx                  # 首页 (Landing)
│   │
│   ├── components/               # React 组件
│   │   ├── AuthModal.tsx         # 登录/注册弹窗
│   │   ├── UserProfileModal.tsx  # 用户资料编辑
│   │   ├── NotificationBell.tsx  # 通知铃铛
│   │   └── CreatePostModal.tsx   # 发帖弹窗
│   │
│   ├── lib/                      # 前端工具库
│   │   ├── api.ts                # API 基础配置 (BASE_URL)
│   │   └── auth.ts               # 认证逻辑 + API 调用
│   │
│   ├── layout.tsx                # 根布局
│   ├── globals.css               # 全局样式
│   └── RouteTransition.tsx       # 路由过渡动画
│
├── backend/                      # 后端 (FastAPI)
│   ├── main.py                   # 应用入口 (~100行)
│   ├── requirements.txt          # Python 依赖
│   ├── .env.example              # 环境变量模板
│   │
│   ├── config/                   # 配置模块
│   │   ├── settings.py           # 应用配置
│   │   └── constants.py          # 常量定义
│   │
│   ├── core/                     # 核心模块
│   │   ├── redis_client.py       # Redis 连接 + Key 生成器
│   │   └── security.py           # 密码哈希 + Token + 认证
│   │
│   ├── models/                   # 数据模型
│   │   └── schemas.py            # Pydantic 请求/响应模型
│   │
│   ├── routers/                  # API 路由
│   │   ├── auth.py               # 认证路由 (/api/auth/*)
│   │   ├── interview.py          # 面试路由 (/api/*)
│   │   ├── posts.py              # 面经路由 (/api/posts/*)
│   │   └── notifications.py      # 通知路由 (/api/notifications/*)
│   │
│   ├── services/                 # 业务逻辑层
│   │   ├── ai_service.py         # AI 模型调用
│   │   ├── interview_service.py  # 面试业务逻辑
│   │   ├── user_service.py       # 用户业务逻辑
│   │   ├── post_service.py       # 面经业务逻辑
│   │   └── notification_service.py # 通知业务逻辑
│   │
│   └── utils/                    # 工具函数
│       ├── json_helper.py        # JSON 提取/解析
│       ├── email_sender.py       # SMTP 邮件发送
│       └── pdf_parser.py         # PDF 文本提取
│
├── README.md                     # 项目说明
├── ARCHITECTURE.md               # 本文档
├── package.json                  # Node.js 配置
├── tsconfig.json                 # TypeScript 配置
└── next.config.ts                # Next.js 配置
```

---

## 四、模块说明

### 前端核心文件

| 文件 | 职责 | 关键函数/组件 |
|------|------|---------------|
| `app/lib/api.ts` | API 基础配置 | `API_BASE_URL` |
| `app/lib/auth.ts` | 认证 + API 封装 | `loginUser`, `fetchPosts`, `createPost` 等 |
| `app/(main)/layout.tsx` | 主布局 | 侧边栏导航、用户信息 |

### 后端核心模块

| 模块 | 职责 | 关键类/函数 |
|------|------|-------------|
| `core/redis_client.py` | Redis 操作 | `redis_client`, `make_user_key()` 等 Key 生成器 |
| `core/security.py` | 安全相关 | `hash_password()`, `get_current_user_from_auth_header()` |
| `services/ai_service.py` | AI 调用 | `AIService.call_api()`, `build_evaluate_prompt()` |
| `services/interview_service.py` | 面试逻辑 | `InterviewService.create_session()`, `chat()`, `evaluate()` |
| `services/user_service.py` | 用户逻辑 | `UserService.register()`, `login()`, `update_profile()` |
| `services/post_service.py` | 面经逻辑 | `PostService.create_post()`, `toggle_like()` |
| `services/notification_service.py` | 通知逻辑 | `push_notification()`, `get_notifications()` |

---

## 五、API 接口概览

### 认证模块 `/api/auth/*`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/send-register-code` | 发送注册验证码 |
| POST | `/register` | 用户注册 |
| POST | `/login` | 用户登录 |
| GET | `/me` | 获取当前用户 |
| POST | `/logout` | 用户登出 |
| PUT | `/profile` | 更新资料 |
| POST | `/avatar` | 上传头像 |

### 面试模块 `/api/*`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/init-interview` | 初始化面试会话 |
| POST | `/chat` | 面试对话 |
| POST | `/evaluate` | 评估面试 |
| GET | `/reports` | 获取报告列表 |
| GET | `/reports/{id}` | 获取报告详情 |
| DELETE | `/reports/{id}` | 删除报告 |

### 面经广场 `/api/*`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/posts` | 创建帖子 |
| GET | `/posts` | 获取帖子列表 |
| GET | `/posts/{id}` | 获取帖子详情 |
| DELETE | `/posts/{id}` | 删除帖子 |
| POST | `/posts/{id}/like` | 点赞/取消点赞 |
| POST | `/posts/{id}/comments` | 创建评论 |
| GET | `/posts/{id}/comments` | 获取评论列表 |
| DELETE | `/posts/{id}/comments/{cid}` | 删除评论 |

### 通知模块 `/api/*`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/notifications` | 获取通知列表 |
| POST | `/notifications/{id}/read` | 标记已读 |
| POST | `/notifications/read-all` | 全部已读 |

---

## 六、数据流说明

### 1. 面试流程

```
用户上传简历 + JD
       ↓
POST /api/init-interview
       ↓
[interview_service.py] AI 生成第一个问题
       ↓
Redis 存储会话 (session:{id})
       ↓
返回 session_id + first_question
       ↓
用户回答 ←→ POST /api/chat (多轮对话)
       ↓
POST /api/evaluate
       ↓
AI 生成评估报告 → Redis 存储 → 返回报告
```

### 2. 认证流程

```
注册/登录
   ↓
[security.py] 密码哈希/验证
   ↓
Redis 存储用户信息 (user:{email})
   ↓
生成 Token → Redis (auth:{token})
   ↓
返回 Token + 用户信息
   ↓
后续请求 Header: Bearer {token}
   ↓
[get_current_user_from_auth_header] 验证 Token
```

### 3. 面经广场流程

```
发帖 → Redis (post_detail:{id}) + 全局列表
   ↓
点赞 → Redis Set (post_likes:{id}) + 通知作者
   ↓
评论 → Redis List (post_comments:{id}) + 通知作者
```

---

## 七、Redis Key 命名规范

| Key 模式 | 用途 |
|----------|------|
| `user:{email}` | 用户数据 (Hash JSON) |
| `auth:{token}` | Token 映射邮箱 |
| `register_code:{email}` | 注册验证码哈希 |
| `session:{id}` | 面试会话数据 |
| `user_reports:{email}` | 用户报告列表 |
| `report:{id}` | 报告详情 |
| `post_detail:{id}` | 帖子详情 |
| `global:post_ids` | 全局帖子 ID 列表 |
| `post_likes:{id}` | 帖子点赞用户 Set |
| `post_comments:{id}` | 帖子评论 List |
| `comment_likes:{id}` | 评论点赞用户 Set |
| `notifications:{email}` | 用户通知 List |

---

## 八、开发规范

### 新增 API 接口步骤

1. **定义模型** - 在 `models/schemas.py` 添加 Pydantic 模型
2. **实现业务** - 在 `services/` 对应服务中添加方法
3. **添加路由** - 在 `routers/` 对应文件中添加端点
4. **注册路由** - 在 `main.py` 中 `app.include_router()`

### 代码组织原则

- **单一职责**：每个服务类只负责一类业务
- **分层清晰**：Router → Service → Utils
- **配置集中**：所有配置在 `config/settings.py`
- **类型完整**：函数参数和返回值都标注类型

### Python 3.8 兼容性规范（重要）

**生产环境使用 Python 3.8，代码必须兼容 Python 3.8 语法。**

#### ❌ 禁止使用的语法（Python 3.9+）

| 语法 | Python 版本 | 替代方案 |
|------|-------------|----------|
| `list[str]` / `dict[str, int]` | 3.9+ | `List[str]` / `Dict[str, int]`（从 typing 导入） |
| `tuple[str, int]` | 3.9+ | `Tuple[str, int]`（从 typing 导入） |
| `str \| None` 联合类型 | 3.10+ | `Optional[str]` 或 `Union[str, None]` |
| `match ... case` | 3.10+ | 使用 if-elif-else |
| `str.removeprefix()` | 3.9+ | 使用切片或 replace |
| `str.removesuffix()` | 3.9+ | 使用切片或 replace |
| `tomllib` 模块 | 3.11+ | 使用 `toml` 第三方库 |
| `typing.Self` | 3.11+ | 使用字符串 `"ClassName"` 或 TypeVar |

#### ✅ 正确的写法示例

```python
from typing import List, Dict, Tuple, Optional, Any

# 函数返回值类型
def get_user(email: str) -> Optional[Dict[str, Any]]:
    pass

# 列表类型
def list_posts() -> List[Dict[str, Any]]:
    pass

# 元组类型（多个返回值）
def get_session(id: str) -> Tuple[Dict[str, Any], str]:
    pass

# 联合类型
def find_user(email: Optional[str] = None) -> Optional[Dict[str, Any]]:
    pass
```

#### 🔍 快速检查方法

```bash
# 本地使用 Python 3.8 运行测试
cd backend
python3.8 -m py_compile main.py
python3.8 -m py_compile services/*.py
```

---

## 九、部署说明

### 开发环境

```bash
# 前端
cd Interview-Copilot
npm install
npm run dev          # http://localhost:3000

# 后端
cd backend
pip install -r requirements.txt
python main.py       # http://localhost:8000
```

### 服务器环境

```bash
# 1. 上传 backend/ 目录

# 2. 安装依赖（Python 3.8+）
pip install -r requirements.txt

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env：Redis、SMTP、AI API Key

# 4. 启动
python main.py
```

### 环境变量清单

| 变量 | 必填 | 说明 |
|------|------|------|
| `REDIS_HOST` | 是 | Redis 地址 |
| `REDIS_PORT` | 否 | 默认 6379 |
| `OPENAI_API_KEY` | 是 | AI API Key |
| `OPENAI_BASE_URL` | 是 | AI API 地址 |
| `SMTP_HOST` | 是 | 邮件服务器 |
| `SMTP_USER` | 是 | 发件邮箱 |
| `SMTP_PASS` | 是 | 邮箱密码 |
| `CORS_ORIGINS` | 否 | 前端地址，逗号分隔 |

---

## 十、常见问题

### Q: 如何调试后端？
```bash
cd backend
python -c "from main import app; print(app.routes)"  # 查看所有路由
```

### Q: 如何添加新字段到用户模型？
1. `models/schemas.py` - 添加字段到 `UpdateProfileRequest`
2. `services/user_service.py` - 在 `update_profile()` 处理字段
3. `core/security.py` - 在返回值中包含字段

### Q: 如何修改 AI Prompt？
- 面试问题生成：`services/ai_service.py` → `generate_first_question()`
- 评估报告生成：`services/ai_service.py` → `build_evaluate_prompt()`

---

**最后更新**: 2026-03-27
**文档版本**: v1.1
