"""质押情况：sWBERA 持仓与解锁队列。数据全部来自链上，不编造"""
from datetime import datetime, timezone
from decimal import Decimal

from app.capabilities.render import render_staking
from app.capabilities.tool import capability
from app.core.config import settings
from app.core.assets import SWBERA
from app.domain.money import from_raw
from app.domain.provenance import Provenance
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext
from app.providers.rpc import BerachainRpc

@capability(description="查询当前登录地址的质押情况", render=render_staking)
async def staking_position(ctx: SessionContext) -> CapabilityResult:
    rpc = BerachainRpc(settings.rpc_url)
    block_height = await rpc.block_number()
    now = await rpc.block_timestamp()

    raw_shares = await rpc.erc20_balance(SWBERA.address, ctx.address)
    raw_assets = 0 if raw_shares == 0 else await rpc.convert_to_assets(
        SWBERA.address, raw_shares
    )

    cooldown = await rpc.withdrawal_cooldown(SWBERA.address)
    request_ids = await rpc.withdrawal_request_ids(SWBERA.address, ctx.address)

    pending: list[dict] = []
    for request_id in request_ids:
        req = await rpc.withdrawal_request(SWBERA.address, request_id)
        ready_at = req["request_time"] + cooldown
        pending.append({
            "request_id": request_id,
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
            "block_height": block_height,
            "block_time": now,
            "in_position": {
                "symbol": "sWBERA",
                "shares": str(from_raw(raw_shares, SWBERA.decimals)),
                "equivalent_wbera": str(from_raw(raw_assets, SWBERA.decimals)),
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
