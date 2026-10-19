"""编排层：越权拦截必须发生在任何取数之前，错误码是前端契约。"""

import asyncio

import pytest

from app.capabilities.balance import BalanceParams
from app.capabilities.base import Capability
from app.core.errors import AddressRejected, IntentUnrecognized
from app.domain.session import SessionContext
from app.services import chat_service

CTX = SessionContext(address="0xde709f2102306220921060314715629080e2fb77")
OTHER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"


def test_other_address_is_rejected_before_any_query():
    with pytest.raises(AddressRejected):
        asyncio.run(chat_service.answer(CTX, f"查一下 {OTHER} 的资产", "conv-1"))


def test_unrecognized_question_raises():
    with pytest.raises(IntentUnrecognized):
        asyncio.run(chat_service.answer(CTX, "今天天气怎么样", "conv-1"))


def test_error_codes_are_stable():
    """前端按 code 分支，这几个值不能随手改。"""
    assert AddressRejected().code == "address_rejected"
    assert IntentUnrecognized().code == "intent_unrecognized"

def test_followup_reuses_last_capability(monkeypatch):
    """上一轮查了资产，这轮只说「还有呢」，应沿用资产能力。"""
    from app.domain.results import CapabilityResult
    from app.domain.provenance import Provenance
    from datetime import datetime, timezone

    class StubCapability(Capability):
        name = "stub"
        input_model = BalanceParams

        async def execute(self, ctx, params):
            return CapabilityResult(
                capability="stub",
                answer={"block_height": 1, "items": [], "total_value_usd": "0", "valuation_note": None},
                provenance=[Provenance(field="x", source="stub", at=datetime.now(timezone.utc))],
            )
