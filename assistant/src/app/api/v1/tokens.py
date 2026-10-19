"""Token 范围接口：读写当前登录地址的查询范围。入参不含地址。"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_session
from app.core.tokens import VERIFIED_TOKENS
from app.domain.session import SessionContext
from app.repositories.token_scope import list_tokens, token_scope_repo

router = APIRouter(prefix="/api/v1/tokens", tags=["tokens"])


class TokenItem(BaseModel):
    symbol: str
    address: str
    selected: bool


class ScopeResponse(BaseModel):
    tokens: list[TokenItem]


class ScopeRequest(BaseModel):
    addresses: list[str] = Field(default_factory=list)


async def _response(address: str) -> ScopeResponse:
    selected = {token.address.lower() for token in await list_tokens(address)}
    return ScopeResponse(
        tokens=[
            TokenItem(
                symbol=token.symbol,
                address=token.address,
                selected=token.address.lower() in selected,
            )
            for token in VERIFIED_TOKENS
        ]
    )


@router.get("", response_model=ScopeResponse)
async def read_scope(session: SessionContext = Depends(get_session)) -> ScopeResponse:
    return await _response(session.address)


@router.put("", response_model=ScopeResponse)
async def update_scope(
    payload: ScopeRequest,
    session: SessionContext = Depends(get_session),
) -> ScopeResponse:
    try:
        await token_scope_repo.set(session.address, payload.addresses)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return await _response(session.address)
