"""编排层：越权拦截必须发生在任何取数之前，错误码是前端契约。"""

import asyncio

import pytest

from app.core.errors import AddressRejected, IntentUnrecognized
from app.domain.session import SessionContext
from app.repositories.chat_context import ChatContextRepository
from app.services import chat_service

CTX = SessionContext(address="0xde709f2102306220921060314715629080e2fb77")
OTHER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"


@pytest.fixture(autouse=True)
def _offline(monkeypatch):
    """编排层单测不碰数据库、不碰模型。"""

    async def no_context(self, conversation_id, owner):
        return None

    async def no_model(text, history=None):
        return None

    monkeypatch.setattr(ChatContextRepository, "get", no_context)
    monkeypatch.setattr(chat_service, "classify", no_model)


def test_other_address_is_rejected_before_any_query():
    with pytest.raises(AddressRejected):
        asyncio.run(chat_service.resolve(CTX, f"查一下 {OTHER} 的资产", "conv-1"))


def test_unrecognized_question_raises():
    with pytest.raises(IntentUnrecognized):
        asyncio.run(chat_service.resolve(CTX, "今天天气怎么样", "conv-1"))


def test_error_codes_are_stable():
    """前端按 code 分支，这几个值不能随手改。"""
    assert AddressRejected().code == "address_rejected"
    assert IntentUnrecognized().code == "intent_unrecognized"


def test_rule_hit_needs_no_model():
    """规则段命中就不该再叫模型。"""
    intent = asyncio.run(chat_service.resolve(CTX, "我的质押资产有多少", "conv-1"))
    assert intent.capability == "staking_position"
    assert intent.supported is True


def test_capability_names_match_registered_tools():
    """意图里的能力名必须能在工具表里找到，否则兜底执行会 KeyError。"""
    assert set(chat_service._TOOLS) == {
        "asset_balance",
        "staking_position",
        "transaction_history",
    }
    assert set(chat_service._TOOLS) == set(chat_service._RENDERERS)
