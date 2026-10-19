"""Nonce 存储：一次性消耗，TTL 到期自动消失。"""
from redis.asyncio import Redis


class NonceRepository:
    def __init__(self, client: Redis, ttl_seconds: int = 300) -> None:
        self._client = client
        self._ttl = ttl_seconds

    async def issue(self, nonce: str, address: str) -> None:
        await self._client.set(f"nonce:{nonce}", address, ex=self._ttl)

    async def consume(self, nonce: str) -> str | None:
        """原子取出并删除。同一个nonce只能被消耗一次"""

        """pipeline(transaction=True) 是这里的关键。如果写成先 get 再 delete 两次独立调用，
        两个并发请求可能同时读到同一个 nonce,都能通过验签——这就是重放。Redis 的 MULTI/EXEC 保证这两步之间不会插入别人的命令。
        consume 而不是 get + 事后 delete：语义上 nonce 天生一次性，取出即作废。
        这也带来一个行为变化——签名验证失败时 nonce 已经被消耗掉，
        用户必须重新申请。这是对的，否则一个 nonce 可以被反复试签。"""
        async with self._client.pipeline(transaction=True) as pipe:
            pipe.get(f"nonce:{nonce}")
            pipe.delete(f"nonce:{nonce}")
            value, _ = await pipe.execute()

        return value
