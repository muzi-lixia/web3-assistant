"""对话接口：受JWT保护，地址只能来自会话"""
import json
import time
from collections.abc import AsyncIterator

import logging
from uuid import uuid4

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.deps import get_session, enforce_chat_rate_limit
from app.core.errors import AppError
from app.domain.session import SessionContext
from app.services import chat_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["chat"])

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}

class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None

def _event(name: str, data: dict) -> str:
    return f"event: {name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

async def _stream(session: SessionContext, message: str, conversation_id: str) -> AsyncIterator[str]:
    yield _event("context", {"conversation_id": conversation_id})
    started = time.perf_counter()

    try:
        intent = await chat_service.resolve(session, message, conversation_id)
    except AppError as exc:
        logger.warning(
            "query capability=- address=%s status=error code=%s ms=%d detail=%s",
            session.address,
            exc.code,
            (time.perf_counter() - started) * 1000,
            exc.detail,
        )
        yield _event("error", {"code": exc.code, "message": exc.message, "retryable": exc.retryable})
        return
    yield _event("intent", { "capability": intent.capability, "reason": intent.reason })
    try:
        text, result = await chat_service.run(session, message, intent, conversation_id)
    except Exception:
        logger.exception("query status=crash address=%s", session.address)
        yield _event(
            "error",
            {
                "code": "internal_error",
                "message": "服务内部错误，请稍后重试",
                "retryable": False
            }
        )
        return
    logger.info(
        "query capability=%s address=%s status=ok ms=%d",
        result.capability,
        session.address,
        (time.perf_counter() - started) * 1000,
    )
    yield _event("answer", {"text": text})
    yield _event("data", {"payload": result.data})
    yield _event(
        "provenance",
        {"items": [item.model_dump(mode="json") for item in result.provenance]},
    )
    yield _event("done", {})


@router.post("/chat")
async def chat(
    payload: ChatRequest,
    session: SessionContext = Depends(get_session),
    _: None = Depends(enforce_chat_rate_limit)
) -> StreamingResponse:
    conversation_id = payload.conversation_id or uuid4().hex
    return StreamingResponse(
        _stream(session, payload.message, conversation_id),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
