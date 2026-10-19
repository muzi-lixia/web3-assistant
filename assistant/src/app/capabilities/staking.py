"""质押情况：sWBERA 持仓与解锁队列。数据全部来自链上，不编造"""
from datetime import datetime, timezone
from decimal import Decimal

from app.capabilities.render import render_staking
from app.capabilities.tool import capability
from app.core.assets import SWBERA
from app.core.config import settings
from app.domain.money import from_raw
from app.domain.provenance import Provenance
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext
from app.providers.rpc import BerachainRpc


@capability(description="查询当前登录地址的质押情况", render=render_staking)
async def staking_position(ctx: SessionContext) -> CapabilityResult:
    snapshot = await BerachainRpc(settings.rpc_url).staking_snapshot(
        SWBERA.address, ctx.address
    )

    now = snapshot["block_time"]
    pending: list[dict] = []
    for req in snapshot["requests"]:
        ready_at = req["request_time"] + snapshot["cooldown"]
        pending.append({
            "request_id": req["request_id"],
            "assets": str(from_raw(req["assets"], SWBERA.decimals)),
            "request_time": req["request_time"],
            "ready_at": ready_at,
            "ready": now >= ready_at,
            "remaining_seconds": max(0, ready_at - now),
        })

    waiting = [item for item in pending if not item["ready"]]
    claimable = [item for item in pending if item["ready"]]

    return CapabilityResult(
        capability="staking_position",
        data={
            "block_height": snapshot["block_number"],
            "block_time": now,
            "in_position": {
                "symbol": "sWBERA",
                "shares": str(from_raw(snapshot["shares"], SWBERA.decimals)),
                "equivalent_wbera": str(from_raw(snapshot["assets"], SWBERA.decimals)),
            },
            "unlocking": {
                "available": True,
                "items": waiting,
                "total_assets": str(
                    sum((Decimal(i["assets"]) for i in waiting), Decimal(0))
                ),
            },
            "claimable": {
                "available": True,
                "items": claimable,
                "total_assets": str(
                    sum((Decimal(i["assets"]) for i in claimable), Decimal(0))
                ),
            },
        },
        provenance=[
            Provenance(
                field="staking",
                source="berachain-rpc",
                at=datetime.now(timezone.utc),
            ),
        ],
    )
