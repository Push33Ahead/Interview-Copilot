"""
Interview Copilot - FastAPI 后端入口

AI 驱动的技术面试模拟平台后端服务
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config.settings import settings
from routers import auth, interview, posts, notifications

# 初始化配置
settings.init_directories()

# 创建 FastAPI 应用
app = FastAPI(
    title="AI Interview API",
    description="Interview Copilot - AI 驱动的技术面试模拟平台",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态文件（头像上传等）
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_BASE_DIR)), name="uploads")

# 注册路由
app.include_router(auth.router)
app.include_router(interview.router)
app.include_router(posts.router)
app.include_router(notifications.router)


@app.get("/")
async def root():
    """根路径 - 健康检查"""
    return {
        "name": "Interview Copilot API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
