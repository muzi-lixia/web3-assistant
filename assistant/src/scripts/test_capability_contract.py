"""能力契约的三条红线：无地址入参、非法入参挡在定义期、无溯源不成立。"""

import asyncio

import pytest
from pydantic import BaseModel, ValidationError

from app.capabilities.balance import BalanceCapability, BalanceParams
from app.capabilities.base import Capability
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext
from app.services import chat_service


def test_input_model_has_no_address_field():
    assert "address" not in BalanceParams.model_fields


def test_subclass_with_address_field_cannot_even_be_defined():
    class BadParams(BaseModel):
        address: str

    with pytest.raises(TypeError):

        class BadCapability(Capability):
            name = "bad"
            input_model = BadParams

            async def execute(self, ctx, params):
                raise NotImplementedError


def test_result_without_provenance_is_rejected():
    with pytest.raises(ValidationError):
        CapabilityResult(capability="x", answer={}, provenance=[])


def test_capability_uses_session_address():
    ctx = SessionContext(address="0xde709f2102306220921060314715629080e2fb77")
    result = asyncio.run(BalanceCapability().execute(ctx, BalanceParams()))
    assert result.answer["address"] == ctx.address
    assert result.provenance

def test_chat_returns_answer_with_provenance():
    ctx = SessionContext(address="0xde709f2102306220921060314715629080e2fb77")
    text, result = asyncio.run(chat_service.answer(ctx, "我现在的资产有多少"))
    assert "BERA" in text
    assert result.provenance


def test_chat_rejects_other_address():
    ctx = SessionContext(address="0xde709f2102306220921060314715629080e2fb77")
    with pytest.raises(chat_service.AddressRejectedError):
        asyncio.run(
            chat_service.answer(ctx, "查一下 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 的资产")
        )