"""能力契约的三条红线：模型看不到地址、地址入参在定义期被拒、无溯源不成立。"""

from dataclasses import FrozenInstanceError

import pytest
from pydantic import ValidationError

from app.capabilities.registry import tools
from app.capabilities.tool import capability
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext


def test_no_tool_exposes_params_to_model():
    """三个工具的参数表必须是空的，地址只能从会话里取。"""
    for item in tools:
        assert item.args == {}, item.name


def test_capability_with_address_param_cannot_be_defined():
    """定义了 address 入参的能力，在装饰那一刻就该失败。"""

    with pytest.raises(TypeError):

        @capability(description="bad", render=lambda result: "")
        async def bad_capability(address: str) -> CapabilityResult:
            raise NotImplementedError


def test_result_without_provenance_is_rejected():
    """没有溯源的结果无法构造，从类型层面拒绝无源答案。"""
    with pytest.raises(ValidationError):
        CapabilityResult(capability="x", data={}, provenance=[])


def test_session_context_is_frozen():
    """会话上下文构造后不可修改，防止红线被就地改写。"""
    ctx = SessionContext(address="0xde709f2102306220921060314715629080e2fb77")
    with pytest.raises(FrozenInstanceError):
        ctx.address = "0x0000000000000000000000000000000000000001"
