"""Nonce 存储：一次性消耗，到期即失效。进程内存，单进程前提。"""

import asyncio
import time

NONCE_TTL_SECONDS = 300


class NonceRepository:
    def __init__(self, ttl_seconds: int = NONCE_TTL_SECONDS) -> None:
        self._ttl = ttl_seconds
        self._items: dict[str, tuple[str, float]] = {}
        self._lock = asyncio.Lock()

    async def issue(self, nonce: str, address: str) -> None:
        async with self._lock:
            if len(self._items) > 256:
                now = time.time()
                for stale in [k for k, v in self._items.items() if v[1] <= now]:
                    del self._items[stale]
            self._items[nonce] = (address, time.time() + self._ttl)

    async def consume(self, nonce: str) -> str | None:
        """原子取出并删除。同一个nonce只能被消耗一次"""

        async with self._lock:
            item = self._items.pop(nonce, None)
        if item is None:
            return None
        address, expires_at = item
        return address if expires_at > time.time() else None


nonce_repo = NonceRepository()
