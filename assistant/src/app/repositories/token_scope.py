"""Token 范围：按归一化地址隔离，存 PostgreSQL。"""

from app.core import db
from app.core.assets import VERIFIED_TOKENS, Token
from app.domain.addresses import normalize_address

_DEFAULT: frozenset[str] = frozenset(token.address.lower() for token in VERIFIED_TOKENS)


class TokenScopeRepository:
    """未配置过的地址返回默认范围（全部已核验 token）"""

    async def get(self, address: str) -> frozenset[str]:
        addresses = await db.pool().fetchval(
            "SELECT addresses FROM token_scopes WHERE owner = $1",
            normalize_address(address),
        )
        if addresses is None:
            return _DEFAULT
        return frozenset(addresses)

    async def set(self, address: str, token_address: list[str]) -> frozenset[str]:
        requested = frozenset(item.lower() for item in token_address)
        unknown = requested - _DEFAULT
        if unknown:
            raise ValueError(f"不在支持范围内的 token: {sorted(unknown)}")
        await db.pool().execute(
            """
            INSERT INTO token_scopes (owner, addresses, updated_at)
            VALUES ($1, $2, now())
            ON CONFLICT (owner) DO UPDATE
               SET addresses = EXCLUDED.addresses, updated_at = now()
            """,
            normalize_address(address),
            sorted(requested),
        )
        return requested


token_scope_repo = TokenScopeRepository()


async def list_tokens(address: str) -> list[Token]:
    """能力层调用入口：本次要查询的 token 列表。"""
    selected = await token_scope_repo.get(address)
    return [token for token in VERIFIED_TOKENS if token.address.lower() in selected]
