"""资产余额能力。"""
from datetime import datetime, timezone
from decimal import Decimal

from app.capabilities.render import render_balance
from app.capabilities.tool import capability
from app.core.config import settings
from app.domain.money import from_raw
from app.domain.provenance import Provenance
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext
from app.providers.pricing import PriceProvider
from app.providers.rpc import BerachainRpc
from app.core.assets import WBERA, SWBERA
from app.repositories.token_scope import list_tokens

PRICE_CHAIN = "berachain"
VALUE_QUANT = Decimal("0.0001")
ONE_SHARE = 10**18

def _usd(amount: Decimal, unit: Decimal | None) -> str | None:
    """没有单价就返回 None，不返回 0——两者业务含义不同。"""
    if unit is None:
        return None
    return str((amount * unit).quantize(VALUE_QUANT))


async def _unit_prices(
    rpc: BerachainRpc, prices: dict[str, Decimal]
) -> dict[str, Decimal]:
    """币种 → 单价(USD)。sWBERA 按链上兑换率折算，不用其市场报价。"""
    wbera = prices.get(WBERA.address.lower())
    if wbera is None:
        return {}
    per_share = Decimal(await rpc.convert_to_assets(SWBERA.address, ONE_SHARE)) / ONE_SHARE
    return {
        "BERA": wbera,
        WBERA.symbol: wbera,
        SWBERA.symbol: (per_share * wbera).quantize(Decimal("1E-8")),
    }


@capability(description="查询当前登录地址的资产余额", render=render_balance)
async def asset_balance(ctx: SessionContext) -> CapabilityResult:
    rpc = BerachainRpc(settings.rpc_url)
    block_height = await rpc.block_number()

    holdings: list[tuple[str, Decimal, bool, str | None]] = [
        ("BERA", await rpc.native_balance(ctx.address), True, None)
    ]
    for token in await list_tokens(ctx.address):
        raw = await rpc.erc20_balance(token.address, ctx.address)
        holdings.append(
            (token.symbol, from_raw(raw, token.decimals), False, token.address)
        )
    prices = await PriceProvider().prices(
        PRICE_CHAIN, [WBERA.address, SWBERA.address]
    )
    units = await _unit_prices(rpc, prices)

    items: list[dict] = []
    total = Decimal(0)
    missing: list[str] = []

    for symbol, amount, is_native, address in holdings:
        unit = units.get(symbol)
        value = _usd(amount, unit)
        if value is None:
            missing.append(symbol)
        else:
            total += Decimal(value)
        items.append(
            {
                "symbol": symbol,
                "amount": str(amount),
                "native": is_native,
                "address": address,
                "price_usd": str(unit) if unit is not None else None,
                "value_usd": value,
            }
        )

    now = datetime.now(timezone.utc)
    return CapabilityResult(
        capability="asset_balance",
        data={
            "address": ctx.address,
            "block_height": block_height,
            "items": items,
            "total_value_usd": str(total.quantize(VALUE_QUANT)),
            "valuation_note": (
                f"{'、'.join(missing)} 暂无报价，合计不含该项" if missing else None
            ),
        },
        provenance=[
            Provenance(field="balances", source="berachain-rpc", at=now),
            Provenance(field="valuation", source="defillama", at=now),
        ],
    )
