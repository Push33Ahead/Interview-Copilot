# Interview Copilot

AI 驱动的技术面试模拟平台。

## 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- **后端**: FastAPI (Python) + Redis
- **AI 模型**: 兼容 OpenAI API 的大语言模型

## 项目结构

```
Interview-Copilot/
├── app/                       # 前端 (Next.js App Router)
│   ├── (main)/                # 主应用路由
│   ├── components/            # React 组件
│   └── lib/                   # 工具库
├── backend/                   # 后端 (FastAPI)
│   ├── main.py                # 入口文件
│   ├── config/                # 配置
│   ├── models/                # 数据模型
│   ├── routers/               # API 路由
│   ├── services/              # 业务逻辑
│   └── utils/                 # 工具函数
└── README.md
```

## 快速开始

### 前端开发

```bash
npm install
npm run dev
```

前端运行于 http://localhost:3000

### 后端开发

```bash
cd backend
pip install -r requirements.txt
python main.py
```

后端运行于 http://localhost:8000

## 环境变量

### 后端 (.env)

```
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# SMTP (邮件发送)
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM=noreply@example.com

# AI API
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.example.com/v1

# 文件上传
UPLOAD_BASE_DIR=uploads

# CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 前端 (.env.local)

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## 功能特性

- 🤖 AI 智能面试官 - 基于简历和 JD 生成个性化问题
- 📝 面经广场 - 分享和浏览面试经验
- 🔔 通知系统 - 点赞、评论实时通知
- 👤 用户系统 - 邮箱注册/登录、头像上传
- 📊 评估报告 - 面试表现分析和改进建议

## License

[LICENSE](./LICENSE)
