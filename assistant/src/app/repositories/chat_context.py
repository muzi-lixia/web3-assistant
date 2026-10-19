"""对话上下文：消息落库，按会话归属隔离。"""

from dataclasses import dataclass

from app.core import db
from app.core.errors import ConversationForbidden


@dataclass
class ChatContext:
    conversation_id: str
    owner: str
    last_question: str | None
    last_capability: str | None


class ChatContextRepository:
    async def get(self, conversation_id: str, owner: str) -> ChatContext | None:
        """别人的会话当它不存在——归属条件在 SQL 里，不靠调用方自觉。"""

        row = await db.pool().fetchrow(
            """
            SELECT
                (SELECT m.content
                   FROM messages m
                  WHERE m.conversation_id = c.id AND m.role = 'user'
                  ORDER BY m.id DESC LIMIT 1) AS last_question,
                (SELECT m.capability
                   FROM messages m
                  WHERE m.conversation_id = c.id AND m.role = 'assistant'
                  ORDER BY m.id DESC LIMIT 1) AS last_capability
              FROM conversations c
             WHERE c.id = $1::uuid AND c.owner = $2
            """,
            conversation_id,
            owner,
        )
        if row is None:
            return None
        return ChatContext(
            conversation_id=conversation_id,
            owner=owner,
            last_question=row["last_question"],
            last_capability=row["last_capability"],
        )

    async def append(
        self,
        conversation_id: str,
        owner: str,
        role: str,
        text: str,
        capability: str | None = None,
        client_msg_id: str | None = None
    ) -> bool:
        """写一条消息。同一会话里重复的 client_msg_id 不重复落库，返回 False。"""

        async with db.pool().acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    """
                    INSERT INTO conversations (id, owner) VALUES ($1::uuid, $2)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    conversation_id,
                    owner,
                )
                inserted = await conn.fetchval(
                    "SELECT owner FROM conversations WHERE id = $1::uuid",
                    conversation_id,
                )
                if inserted != owner:
                    raise ConversationForbidden()
                inserted = await conn.fetchval(
                    """
                    INSERT INTO messages
                        (conversation_id, role, content, capability, client_msg_id)
                    VALUES ($1::uuid, $2, $3, $4, $5)
                    ON CONFLICT (conversation_id, client_msg_id)
                        WHERE client_msg_id IS NOT NULL
                    DO NOTHING
                    RETURNING id
                    """,
                    conversation_id,
                    role,
                    text,
                    capability,
                    client_msg_id,
                )
                if inserted is None:
                    return False
                await conn.execute(
                    "UPDATE conversations SET updated_at = now() WHERE id = $1::uuid",
                    conversation_id,
                )
                return True


chat_context_repo = ChatContextRepository()
