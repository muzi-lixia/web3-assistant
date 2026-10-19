"""对话上下文：记住上一轮问的是什么能力。TTL 跟随令牌剩余寿命。"""


import time
from dataclasses import dataclass, asdict
import json
from redis.asyncio import Redis

from app.core.redis import redis


@dataclass(frozen=True)
class ChatContext:
    conversation_id: str
    address: str
    last_capability: str | None
    last_question: str | None
    expires_at: float


class ChatContextRepository:
    def __init__(self, client: Redis) -> None:
        self._client = client

    @staticmethod
    def _key(conversation_id: str) -> str:
        return f"ctx:{conversation_id}"

    async def get(self, conversation_id: str) -> ChatContext | None:
        raw = await self._client.get(self._key(conversation_id))
        if raw is None:
            return None
        data = json.loads(raw)
        data.setdefault("last_question", None)
        if data['expires_at'] <= time.time():
            await self._client.delete(self._key(conversation_id))
            return None

        return ChatContext(**data)

    async def save(self, context: ChatContext) -> None:
        ttl = int(context.expires_at - time.time())
        if ttl <= 0:
            return
        await self._client.set(self._key(context.conversation_id), json.dumps(asdict(context)), ex=ttl)

chat_context_repo = ChatContextRepository(redis)
