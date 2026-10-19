"""Token 范围：按归一化地址隔离，存Redis。"""
import json

from app.core.redis import redis
from app.core.assets import VERIFIED_TOKENS, Token
from app.domain.addresses import normalize_address

_DEFAULT: frozenset[str] = frozenset(token.address.lower() for token in VERIFIED_TOKENS)

class TokenScopeRepository:
    """未配置过的地址返回默认范围（全部已核验 token）"""

    def __init__(self, client):
        self._client = client

    @staticmethod
    def _key(address: str) -> str:
        return f"scope:{normalize_address(address)}"

    async def get(self, address: str) -> frozenset[str]:
        raw = await self._client.get(self._key(address))
        if raw is None:
            return _DEFAULT
        return frozenset(json.loads(raw))

    async def set(self, address: str, token_address: list[str]) -> frozenset[str]:
        requested = frozenset(item.lower() for item in token_address)
        unknown = requested - _DEFAULT

        if unknown:
            raise ValueError(f"不在支持范围内的 token: {sorted(unknown)}")
        await self._client.set(self._key(address), json.dumps(sorted(requested)))
        return requested

token_scope_repo = TokenScopeRepository(redis)

async def list_tokens(address: str) -> list[Token]:
    """能力层调用入口：本次要查询的 token 列表。"""
    selected = await token_scope_repo.get(address)
    return [token for token in VERIFIED_TOKENS if token.address.lower() in selected]

