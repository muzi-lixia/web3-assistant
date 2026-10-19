"""FastAPI 依赖：从请求头解析令牌，产出会话上下文"""
from fastapi import Header, HTTPException, Depends

from app.domain.session import SessionContext
from app.core.security import decode_access_token, TokenError
from app.repositories.rate_limit import chat_limiter
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

async def enforce_chat_rate_limit(
    session: SessionContext = Depends(get_session),
) -> None:
    retry_after = await chat_limiter.hit(session.address)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail="请求过于频繁，请稍后重试",
            headers={"Retry-After": str(int(retry_after) + 1)},
        )
