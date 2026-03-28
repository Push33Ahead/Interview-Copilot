"""常量定义"""

# Token 有效期
AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 天
REGISTER_CODE_TTL_SECONDS = 300  # 5 分钟
REGISTER_CODE_COOLDOWN_SECONDS = 60  # 60 秒可重发

# 面试配置
MAX_INTERVIEW_TURNS = 15
SESSION_TTL_SECONDS = 7200  # 2 小时
REPORT_TTL_SECONDS = 60 * 60 * 24 * 90  # 90 天

# 文件上传
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]

# 通知
MAX_NOTIFICATIONS = 100

# 模型配置
DEFAULT_MODEL = "mimo-v2-pro"
DEFAULT_MAX_TOKENS = 2000
DEFAULT_TEMPERATURE = 0.3
