"""按 key 的固定窗口限流。计数在进程内存里，前提是单进程部署。"""

import asyncio
import time

from app.core.config import settings


class FixedWindowLimiter:
    def __init__(self, limit: int, window_seconds: int, name: str = "default") -> None:
        self._limit = limit
        self._window = window_seconds
        self._name = name
        self._counts: dict[str, list] = {}
        self._lock = asyncio.Lock()

    async def hit(self, key: str) -> float | None:
        """放行返回None，拒绝返回需要等待的描述"""

        bucket = int(time.time()) // self._window
        async with self._lock:
            if len(self._counts) > 256:
                for stale in [k for k, v in self._counts.items() if v[0] != bucket]:
                    del self._counts[stale]
            entry = self._counts.setdefault(key, [bucket, 0])
            if entry[0] != bucket:
                entry[0] = bucket
                entry[1] = 0
            entry[1] += 1
            count = entry[1]

        if count <= self._limit:
            return None
        return float((bucket + 1) * self._window - time.time())


chat_limiter = FixedWindowLimiter(
    limit=settings.chat_rate_limit_per_minute,
    window_seconds=60,
    name="chat",
)

nonce_limiter = FixedWindowLimiter(
    limit=settings.nonce_rate_limit_per_minute,
    window_seconds=60,
    name="nonce",
)
