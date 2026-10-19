"""登录第一步：下发nonce与待签名消息"""

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel

from app.api.deps import SessionContext, get_session
from app.core.config import settings
from app.core.redis import redis
from app.core.security import extract_nonce, SignatureError, recover_address, create_access_token, decode_access_token, TokenError
from app.domain.normalization import to_display_address, AddressError
from app.repositories.revocation import revocation_list
from app.repositories.nonce_repo import NonceRepository

nonce_repo = NonceRepository(redis)
NONCE_TTL_SECONDS = 300

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["auth"]
)

class NonceRequest(BaseModel):
    address: str

class NonceResponse(BaseModel):
    nonce: str
    message: str
    expires_in: int

@router.post("/nonce")
async def issue_nonce(payload: NonceRequest) -> NonceResponse:
    """登录第一步：下发nonce与待签名消息"""

    try:
        display_address = to_display_address(payload.address)
    except AddressError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    nonce = secrets.token_hex(16)
    await nonce_repo.issue(nonce, display_address.lower())

    issue_at = datetime.now(timezone.utc)

    message = (
        f"{settings.session_domain} wants you to sign in with your Ethereum account:\n"
        f"{display_address}\n"
        f"\n"
        f"{settings.session_statement}\n"
        f"\n"
        f"URI: {settings.session_url}\n"
        f"Version: 1\n"
        f"Chain ID: {settings.chain_id}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issue_at.isoformat()}"
    )

    return NonceResponse(nonce=nonce, message=message, expires_in=NONCE_TTL_SECONDS)


class VerifyRequest(BaseModel):
    message: str
    signature: str

class VerifyResponse(BaseModel):
    address: str
    display_address: str
    token: str
    expires_in: int

@router.post("/verify", response_model=VerifyResponse)
async def verify_signature(payload: VerifyRequest) -> VerifyResponse:
    try:
        nonce = extract_nonce(payload.message)
    except SignatureError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    expected = await nonce_repo.consume(nonce)
    if expected is None:
        raise HTTPException(status_code=401, detail="nonce 不存在或已过期")

    try:
        recovered = recover_address(payload.message, payload.signature)
    except SignatureError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    if recovered != expected:
        raise HTTPException(status_code=401, detail="签名地址与申请 nonce 地址不一致")

    token, expires_in = create_access_token(recovered)

    return VerifyResponse(
        address=recovered,
        display_address=to_display_address(recovered),
        token=token,
        expires_in=expires_in
    )

@router.get("/me")
async def me(session: SessionContext=Depends(get_session)) -> dict:
    return {
        "address": session.address,
        "display_address": to_display_address(session.address)
    }

@router.post("/logout")
async def logout(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="缺少令牌")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = decode_access_token(token)
    except TokenError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    jti = payload.get("jti")
    expires_in = payload.get("exp")
    if jti and expires_in:
        await revocation_list.revoke(jti, int(expires_in))

    return {"status": "logged_out"}

