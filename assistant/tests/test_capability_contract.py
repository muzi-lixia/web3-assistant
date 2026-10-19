"""能力契约的三条红线：模型看不到地址、工具只能收白名单参数、无溯源不成立。"""

from dataclasses import FrozenInstanceError

import pytest
from pydantic import ValidationError

from app.capabilities.registry import tools
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext

ADDRESS_FIELDS = frozenset({"address", "account", "wallet", "owner"})


def test_no_tool_accepts_an_address_parameter():
    """地址只能从会话里取，任何工具都不许留一个让模型填地址的口子。"""
    for item in tools:
        assert not (ADDRESS_FIELDS & set(item.args)), item.name


def test_balance_symbol_is_a_closed_set():
    """币种白名单写进 schema：模型只能从这三个里选，选错在参数层就被拒。"""
    schema = next(item for item in tools if item.name == "asset_balance").args["symbol"]
    allowed: set[str] = set()
    for branch in schema.get("anyOf", [schema]):
        allowed |= set(branch.get("enum") or [])
    assert allowed == {"BERA", "WBERA", "sWBERA"}


def test_result_without_provenance_is_rejected():
    """没有溯源的结果无法构造，从类型层面拒绝无源答案。"""
    with pytest.raises(ValidationError):
        CapabilityResult(capability="x", data={}, provenance=[])


def test_session_context_is_frozen():
    """会话上下文构造后不可修改，防止红线被就地改写。"""
    ctx = SessionContext(address="0xde709f2102306220921060314715629080e2fb77")
    with pytest.raises(FrozenInstanceError):
        ctx.address = "0x0000000000000000000000000000000000000001"
