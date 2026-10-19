"""redis客户端：全项目唯一入口，链接在此处统一配置"""
from redis.asyncio import Redis

from app.core.config import settings

# decode_responses=True 让读出来的是 str 不是 bytes——否则每个调用点都要 decode()，
# 迟早漏一个，然后在比较时得到 b"0x..." == "0x..." 为 False 这种极难查的结果。
redis: Redis = Redis.from_url(settings.redis_url, decode_responses=True)
