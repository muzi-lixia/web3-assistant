"""对话接口：受JWT保护，地址只能来自会话"""
import json
import time
from collections.abc import AsyncIterator

import logging
from uuid import uuid4, UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.deps import get_session, chat_rate_limit
from app.core.config import settings
from app.core.errors import AppError, RateLimited
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext
from app.services import chat_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["chat"])

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=settings.chat_message_max_chars)
    conversation_id: UUID | None = None
    client_msg_id: UUID | None = None

def _event(name: str, data: dict) -> str:
    return f"event: {name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

async def _stream(
    session: SessionContext,
    message: str,
    conversation_id: str,
    retry_after: float | None = None,
    client_msg_id: str | None = None
) -> AsyncIterator[str]:
    yield _event("context", {"conversation_id": conversation_id})
    started = time.perf_counter()

    if retry_after is not None:
        exc = RateLimited()
        logger.warning(
            "chat.rate_limited",
            extra={
                "conversation_id": conversation_id,
                "status": "rate_limited",
                "error_code": exc.code,
                "duration_ms": round((time.perf_counter() - started) * 1000, 2),
            },
        )
        yield _event(
            "error",
            {
                "code": exc.code,
                "message": exc.message,
                "retryable": exc.retryable,
                "retry_after": int(retry_after) + 1,
            },
        )
        return

    try:
        intent = await chat_service.resolve(session, message, conversation_id)
    except AppError as exc:
        logger.warning(
            "chat.failed",
            extra={
                "conversation_id": conversation_id,
                "stage": "resolve",
                "error_code": exc.code,
                "duration_ms": round((time.perf_counter() - started) * 1000, 2),
            },
        )
        yield _event("error", {"code": exc.code, "message": exc.message, "retryable": exc.retryable})
        return
    yield _event("intent", {"capability": intent.capability, "reason": intent.reason})

    first_delta_at: float | None = None
    calls: list[CapabilityResult] = []
    try:
        async for name, payload in chat_service.run_stream(
            session, message, intent, conversation_id, client_msg_id
        ):
            if name == "delta":
                if first_delta_at is None:
                    first_delta_at = time.perf_counter()
                yield _event("delta", payload)
            elif name == "answer":
                yield _event("answer", payload)
            elif name == "duplicate":
                logger.warning(
                    "chat.duplicate", extra={"conversation_id": conversation_id}
                )
                yield _event(
                    "error",
                    {
                        "code": "duplicate_request",
                        "message": "重复请求已忽略",
                        "retryable": False,
                    },
                )
                return
            elif name == "calls":
                calls = payload
    except AppError as exc:
        logger.warning(
            "chat.failed",
            extra={
                "conversation_id": conversation_id,
                "capability": intent.capability,
                "stage": "agent",
                "error_code": exc.code,
                "duration_ms": round((time.perf_counter() - started) * 1000, 2),
            },
        )
        yield _event("error", {"code": exc.code, "message": exc.message, "retryable": exc.retryable})
        return
    except Exception:
        logger.exception(
            "chat.failed",
            extra={
                "conversation_id": conversation_id,
                "capability": intent.capability,
                "stage": "agent",
            },
        )
        yield _event(
            "error",
            {
                "code": "internal_error",
                "message": "服务内部错误，请稍后重试",
                "retryable": False
            }
        )
        return

    if not calls:
        logger.error(
            "chat.empty",
            extra={
                "conversation_id": conversation_id,
                "capability": intent.capability,
            },
        )
        yield _event(
            "error",
            {
                "code": "internal_error",
                "message": "服务内部错误，请稍后重试",
                "retryable": False
            }
        )
        return
    first_delta_ms = (
        int((first_delta_at - started) * 1000) if first_delta_at is not None else -1
    )
    logger.info(
        "chat.turn",
        extra={
            "conversation_id": conversation_id,
            "capability": "+".join(item.capability for item in calls),
            "status": "ok",
            "duration_ms": round((time.perf_counter() - started) * 1000, 2),
            "first_token_ms": first_delta_ms,
            "result_count": len(calls),
            "model": settings.intent_model,
        },
    )
    yield _event(
        "data",
        {
            "calls": [
                {
                    "name": item.capability,
                    "arguments": item.arguments,
                    "data": item.data,
                    "provenance": [p.model_dump(mode="json") for p in item.provenance],
                }
                for item in calls
            ]
        },
    )
    yield _event(
        "trace",
        {
            "model": settings.intent_model,
            "prompts": {
                "classify": chat_service.CLASSIFY_PROMPT,
                "agent": chat_service.AGENT_PROMPT,
            },
        },
    )
    yield _event("done", {})


@router.post("/chat")
async def chat(
    payload: ChatRequest,
    session: SessionContext = Depends(get_session),
    retry_after: float | None = Depends(chat_rate_limit),
) -> StreamingResponse:
    conversation_id = str(payload.conversation_id or uuid4())
    return StreamingResponse(
        _stream(session, payload.message, conversation_id, retry_after, payload.client_msg_id),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
