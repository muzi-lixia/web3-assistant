"""FastAPI 依赖：从请求头解析令牌，产出会话上下文"""
from fastapi import Header, HTTPException, Depends, Request

from app.domain.session import SessionContext
from app.core.security import decode_access_token, TokenError
from app.repositories.rate_limit import chat_limiter, nonce_limiter
from app.repositories.revocation import revocation_list


async def get_session(authorization: str | None = Header(default=None)) -> SessionContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="缺少令牌")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = decode_access_token(token)
    except TokenError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    jti = payload.get("jti")
    if not jti or await revocation_list.is_revoked(jti):
        raise HTTPException(status_code=401, detail="令牌已失效")

    address = payload.get("sub")
    if not address:
        raise HTTPException(status_code=401, detail="令牌缺少地址")

    return SessionContext(address=address, expires_at=int(payload.get('exp') or 0))

async def chat_rate_limit(
    session: SessionContext = Depends(get_session),
) -> float | None:
    """放行返回 None，超限返回需要等待的秒数。

    不在依赖里抛 429：对话是 SSE，超限也要走事件，前端只有一套解析。
    """
    return await chat_limiter.hit(session.address)

async def enforce_nonce_rate_limit(request: Request) -> None:
    """按来源 IP 限制 nonce 申请，避免匿名接口被刷爆。"""
    host = request.client.host if request.client else "unknown"
    retry_after = await nonce_limiter.hit(host)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail="请求过于频繁，请稍后重试",
            headers={"Retry-After": str(int(retry_after) + 1)},
        )
