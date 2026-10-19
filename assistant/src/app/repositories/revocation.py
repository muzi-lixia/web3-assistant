"""吊销集：记录已登出的 jti，直到令牌自身过期。
"""

import time
from redis.asyncio import Redis
from app.core.redis import redis


class RevocationList:
    def __init__(self, client: Redis) -> None:
        self._client = client

    async def revoke(self, jti: str, expires_at: int) -> None:
        ttl = expires_at - int(time.time())
        if ttl > 0:
            await self._client.setex(f"revoked:{jti}", ttl, "1")

    async def is_revoked(self, jti: str) -> bool:
        return bool(await self._client.exists(f"revoked:{jti}"))


revocation_list = RevocationList(redis)
