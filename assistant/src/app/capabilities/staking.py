"""质押情况：sWBERA 持仓折算。解锁队列暂不可得，不编造"""
from datetime import datetime, timezone

from pydantic import BaseModel

from app.capabilities.base import Capability
from app.core.config import settings
from app.core.tokens import SWBERA
from app.domain.provenance import Provenance
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext
from app.providers.rpc import BerachainRpc
from app.domain.money import from_raw

class StakingParams(BaseModel):
    """质押查询不需要任何参数"""


class StakingCapability(Capability):
    name = "staking_position"
    description = "查询当前登录地址的质押情况"
    input_model = StakingParams

    async def execute(self, ctx: SessionContext, params: StakingParams) -> CapabilityResult:
        rpc = BerachainRpc(settings.rpc_url)
        block_height = await rpc.block_number()

        raw_shares = await rpc.erc20_balance(SWBERA.address, ctx.address)
        if raw_shares == 0:
            raw_assets = 0
        else:
            raw_assets = await rpc.convert_to_assets(SWBERA.address, raw_shares)

        return CapabilityResult(
            capability=self.name,
            answer={
                "block_height": block_height,
                "in_position": {
                    "symbol": "sWBERA",
                    "shares": str(from_raw(raw_shares, SWBERA.decimals)),
                    "equivalent_wbera": str(from_raw(raw_assets, SWBERA.decimals)),
                },
                "unlocking": {
                    "available": False,
                    "reason": "解锁队列读取方法尚未确认，暂不返回",
                },
                "claimable": {
                    "available": False,
                    "reason": "依赖解锁队列，随其一起暂不可得",
                },
            },
            provenance=[
                Provenance(
                    field="staking.in_position",
                    source="berachain-rpc",
                    at=datetime.now(timezone.utc),
                ),
            ],
        )
