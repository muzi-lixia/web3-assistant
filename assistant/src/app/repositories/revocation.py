"""吊销集：记录已登出的 jti，直到令牌自身过期。"""

import time

from app.core import db


class RevocationList:
    async def revoke(self, jti: str, expires_at: int) -> None:
        if expires_at <= int(time.time()):
            return
        await db.pool().execute(
            """
            INSERT INTO revoked_tokens (jti, expires_at)
            VALUES ($1, to_timestamp($2))
            ON CONFLICT (jti) DO NOTHING
            """,
            jti,
            expires_at,
        )

    async def is_revoked(self, jti: str) -> bool:
        found = await db.pool().fetchval(
            "SELECT 1 FROM revoked_tokens WHERE jti = $1 AND expires_at > now()",
            jti,
        )
        return found is not None


revocation_list = RevocationList()
