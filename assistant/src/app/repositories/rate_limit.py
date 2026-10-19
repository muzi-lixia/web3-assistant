"""按地址的固定窗口限流。Redis"""

import time
from redis.asyncio import Redis
from app.core.config import settings
from app.core.redis import redis


class FixedWindowLimiter:
    def __init__(self, client: Redis, limit: int, window_seconds: int) -> None:
        self._client = client
        self._limit = limit
        self._window = window_seconds

    def _key(self, key: str) -> str:
        bucket = int(time.time()) // self._window
        return f"rate:chat:{key}:{bucket}"

    async def hit(self, key: str) -> float | None:
        """放行返回None，拒绝返回需要等待的描述"""

        name = self._key(key)
        count = await self._client.incr(name)
        if count == 1:
            await self._client.expire(name, self._window)
        if count <= self._limit:
            return None
        ttl = await self._client.ttl(name)
        return float(ttl) if ttl > 0 else float(self._window)

chat_limiter = FixedWindowLimiter(
    redis,
    limit=settings.chat_rate_limit_per_minute,
    window_seconds=60
)
