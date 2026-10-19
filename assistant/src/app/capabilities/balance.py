"""资产余额能力。"""
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, Literal

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool, InjectedToolArg
from pydantic import Field
from app.capabilities.render import render_balance
from app.capabilities.tool import current_turn
from app.core.assets import SWBERA, WBERA
from app.core.config import settings
from app.core.errors import AppError
from app.core.logging import span
from app.domain.money import from_raw
from app.domain.provenance import Provenance
from app.domain.results import CapabilityResult
from app.providers.pricing import PriceProvider
from app.providers.rpc import BerachainRpc
from app.repositories.token_scope import list_tokens

logger = logging.getLogger(__name__)

PRICE_CHAIN = "berachain"
VALUE_QUANT = Decimal("0.0001")
ONE_SHARE = 10**18

BalanceSymbol = Literal["BERA", "WBERA", "sWBERA"]


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


def _valuation_note(units: dict[str, Decimal], missing: list[str]) -> str | None:
    """估值口径：整轮无报价，或部分币种缺价。"""
    if not units:
        return "当前无法获取报价，合计未估值"
    if missing:
        return f"{'、'.join(missing)} 暂无报价，合计不含该项"
    return None


@tool(
    description=(
        "查询当前登录地址的资产余额，每次调用实时读链上最新区块。"
        "适用场景：用户问「我的余额」「我有多少 X」「我持有多少 X」「我一共有多少资产」。"
        "参数约定：用户点到的币种填进 symbol，一个也没点到时留空，不要为此追问。"
        "禁止场景：用户问的是质押份额、在押数量或解锁进度时，改用 staking_position。"
        "特殊规则：BERA 与 WBERA 相互独立，不会自动互相转换；严格按用户点到的币种查询，"
        "不猜测，不扩大范围；历史提问只用来判断「呢」「那」指的是哪个动作，"
        "不要把历史里出现过的币种一起查询，每轮只查用户当前这句点到的币种；"
        "不得沿用历史轮次里的旧余额。"
    )
)
async def asset_balance(
    config: Annotated[RunnableConfig, InjectedToolArg],
    symbol: Annotated[
        BalanceSymbol | None,
        Field(description="用户点到的币种；一个也没点到就留空，表示查全部持仓"),
    ] = None,
) -> str:
    with span("tool.completed", tool="asset_balance"):
        turn = current_turn(config)
        ctx = turn.ctx
        rpc = BerachainRpc(settings.rpc_url)
        tokens = await list_tokens(ctx.address)
        block_height, native, token_raws = await rpc.balances_snapshot(
            ctx.address, [token.address for token in tokens]
        )

        holdings: list[tuple[str, Decimal, bool, str | None]] = [
            ("BERA", native, True, None)
        ]
        for token, raw in zip(tokens, token_raws):
            holdings.append(
                (token.symbol, from_raw(raw, token.decimals), False, token.address)
            )
        if symbol is not None:
            holdings = [item for item in holdings if item[0] == symbol]

        try:
            prices = await PriceProvider().prices(
                PRICE_CHAIN, [WBERA.address, SWBERA.address]
            )
        except AppError as exc:
            # 报价是增值信息，取不到不该带走余额本身
            logger.warning(
                "price.unavailable",
                extra={"stage": "pricing", "error_code": exc.code},
            )
            prices = {}

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
        provenance = [Provenance(field="balances", source="berachain-rpc", at=now)]
        if units:
            provenance.append(Provenance(field="valuation", source="defillama", at=now))

        result = CapabilityResult(
            capability="asset_balance",
            data={
                "address": ctx.address,
                "block_height": block_height,
                "symbol": symbol,
                "items": items,
                "total_value_usd": str(total.quantize(VALUE_QUANT)),
                "valuation_note": _valuation_note(units, missing),
            },
            provenance=provenance,
        )

        turn.results.append(result)
        return render_balance(result)
