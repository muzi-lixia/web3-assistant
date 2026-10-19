"""固定窗口：到达上限即拒绝，换窗口后重新放行。"""

import asyncio

from app.repositories import rate_limit
from app.repositories.rate_limit import FixedWindowLimiter


def test_allows_up_to_limit_then_rejects():
    """前 N 次放行，第 N+1 次返回剩余等待秒数。"""

    async def run() -> None:
        limiter = FixedWindowLimiter(limit=3, window_seconds=60)
        assert await limiter.hit("a") is None
        assert await limiter.hit("a") is None
        assert await limiter.hit("a") is None
        wait = await limiter.hit("a")
        assert wait is not None
        assert 0 <= wait <= 60

    asyncio.run(run())


def test_addresses_are_isolated():
    """一个地址打满不影响另一个地址。"""

    async def run() -> None:
        limiter = FixedWindowLimiter(limit=1, window_seconds=60)
        assert await limiter.hit("a") is None
        assert await limiter.hit("a") is not None
        assert await limiter.hit("b") is None

    asyncio.run(run())


def test_new_window_resets(monkeypatch):
    """换一个窗口之后就重新计数。"""

    async def run() -> None:
        monkeypatch.setattr(rate_limit.time, "time", lambda: 1000.0)
        limiter = FixedWindowLimiter(limit=1, window_seconds=60)
        assert await limiter.hit("a") is None
        assert await limiter.hit("a") is not None

        monkeypatch.setattr(rate_limit.time, "time", lambda: 1060.0)
        assert await limiter.hit("a") is None

    asyncio.run(run())
