"""交易记录：只读，按会话地址查最近交易。"""

from datetime import datetime, timezone

from pydantic import BaseModel

from app.capabilities.base import Capability
from app.core.config import settings
from app.domain.money import from_raw
from app.domain.provenance import Provenance
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext
from app.providers.explorer import ExplorerProvider

DEFAULT_LIMIT = 20


class TransactionParams(BaseModel):
    """交易记录不需要入参：地址来自会话，条数用默认值"""


class TransactionHistoryCapability(Capability):
    name = "transaction_history"
    description = "查询当前登录地址的最近交易记录"
    input_model = TransactionParams

    async def execute(self, ctx: SessionContext, params: TransactionParams) -> CapabilityResult:
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

        return CapabilityResult(
            capability=self.name,
            answer={
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
