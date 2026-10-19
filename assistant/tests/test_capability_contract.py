"""能力契约的三条红线：无地址入参、非法入参挡在定义期、无溯源不成立。"""

from dataclasses import FrozenInstanceError

import pytest
from pydantic import BaseModel, ValidationError

from app.capabilities.balance import BalanceParams
from app.capabilities.base import Capability
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext


def test_balance_params_has_no_address_field():
    """资产查询的入参里不允许出现 address。"""
    assert "address" not in BalanceParams.model_fields


def test_capability_with_address_param_cannot_be_defined():
    """定义了 address 入参的能力，在类创建那一刻就该失败。"""

    class BadParams(BaseModel):
        address: str

    with pytest.raises(TypeError):

        class BadCapability(Capability):
            name = "bad"
            input_model = BadParams

            async def execute(self, ctx, params):
                raise NotImplementedError


def test_result_without_provenance_is_rejected():
    """没有溯源的结果无法构造，从类型层面拒绝无源答案。"""
    with pytest.raises(ValidationError):
        CapabilityResult(capability="x", answer={}, provenance=[])


def test_session_context_is_frozen():
    """会话上下文构造后不可修改，防止红线被就地改写。"""
    ctx = SessionContext(address="0xde709f2102306220921060314715629080e2fb77")
    with pytest.raises(FrozenInstanceError):
        ctx.address = "0x0000000000000000000000000000000000000001"
