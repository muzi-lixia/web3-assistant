"""能力契约：所有查询能力的统一形状，地址字段在此处被结构性禁止"""
from abc import ABC, abstractmethod
from typing import ClassVar

from pydantic import BaseModel

from app.domain.results import CapabilityResult
from app.domain.session import SessionContext

FORBIDDEN_INPUT_FIELDS = frozenset({"address", "account", "wallet", "owner"})

class Capability(ABC):
    name: ClassVar[str]
    description: ClassVar[str]
    input_model: ClassVar[type[BaseModel]]

    def __init_subclass__(cls, **kwargs) -> None:
        super().__init_subclass__(**kwargs)
        model = getattr(cls, "input_model", None)
        if model is None:
            return
        forbidden = FORBIDDEN_INPUT_FIELDS & set(model.model_fields)
        if forbidden:
            raise TypeError(
                f"{cls.__name__}.input_model 不允许出现地址字段: {sorted(forbidden)}"
            )

    @abstractmethod
    async def execute(self, ctx: SessionContext, params: BaseModel) -> CapabilityResult:
        """执行查询。地址只能从 ctx.address 取。"""
