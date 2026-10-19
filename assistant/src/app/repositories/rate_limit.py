"""按 key 的固定窗口限流。Redis 侧用 Lua 保证计数与过期时间一起写入。"""

import time
from redis.asyncio import Redis
from app.core.config import settings
from app.core.redis import redis

# 先 INCR 再按结果决定是否 EXPIRE，两步必须原子：分开调用时进程在中间退出会留下永不过期的 key
_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
"""


class FixedWindowLimiter:
    def __init__(
        self, client: Redis, limit: int, window_seconds: int, name: str = "default"
    ) -> None:
        self._client = client
        self._limit = limit
        self._window = window_seconds
        self._name = name

    def _key(self, key: str) -> str:
        bucket = int(time.time()) // self._window
        return f"rate:{self._name}:{key}:{bucket}"

    async def hit(self, key: str) -> float | None:
        """放行返回None，拒绝返回需要等待的描述"""

        name = self._key(key)
        count = await self._client.eval(_SCRIPT, 1, name, self._window)
        if count <= self._limit:
            return None
        ttl = await self._client.ttl(name)
        return float(ttl) if ttl > 0 else float(self._window)


chat_limiter = FixedWindowLimiter(
    redis,
    limit=settings.chat_rate_limit_per_minute,
    window_seconds=60,
    name="chat",
)

nonce_limiter = FixedWindowLimiter(
    redis,
    limit=settings.nonce_rate_limit_per_minute,
    window_seconds=60,
    name="nonce",
)
