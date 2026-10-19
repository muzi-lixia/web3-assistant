"""PostgreSQL 连接池：全项目唯一入口。"""
import asyncpg

from app.core.config import settings

_pool: asyncpg.Pool | None = None

async def init() -> None:
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=1,
        max_size=10,
        command_timeout=10
    )

async def close() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None

def pool() -> asyncpg.Pool:
    """仓储层取连接用。未初始化即编程错误，直接抛。"""

    if _pool is None:
        raise RuntimeError("连接池未初始化")
    return _pool
