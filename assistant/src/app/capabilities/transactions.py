"""交易记录：只读，按会话地址查最近交易。"""

from datetime import datetime, timezone
from typing import Annotated

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool, InjectedToolArg

from app.capabilities.render import render_transactions
from app.capabilities.tool import current_turn
from app.core.config import settings
from app.core.logging import span
from app.domain.money import from_raw
from app.domain.provenance import Provenance
from app.domain.results import CapabilityResult
from app.providers.explorer import ExplorerProvider

DEFAULT_LIMIT = 20

@tool(description="查询当前登录地址的最近交易记录")
async def transaction_history(config: Annotated[RunnableConfig, InjectedToolArg]) -> str:
    with span("tool.completed", tool="transaction_history"):
        turn = current_turn(config)
        ctx = turn.ctx
        provider = ExplorerProvider(settings.etherscan_api_key, settings.chain_id)
        rows = await provider.transactions(ctx.address, limit=DEFAULT_LIMIT)

        me = ctx.address.lower()
        items = [
            {
                "hash": row["hash"],
                "timestamp": int(row["timeStamp"]),
                "from": row["from"],
                "to": row["to"],
                "direction": "in" if row["to"].lower() == me else "out",
                "value": str(from_raw(int(row["value"]))),
                "block": int(row["blockNumber"]),
                "status": "ok" if row.get("isError") == "0" else "failed",
            }
            for row in rows
        ]

        result = CapabilityResult(
            capability="transaction_history",
            data={
                "address": ctx.address,
                "items": items,
                "count": len(items),
                "limit": DEFAULT_LIMIT,
            },
            provenance=[
                Provenance(
                    field="transactions",
                    source="etherscan-v2",
                    at=datetime.now(timezone.utc),
                ),
            ],
        )

        turn.results.append(result)
        return render_transactions(result)
