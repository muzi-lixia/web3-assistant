"""能力 → 工具：一处守住地址红线和答案溯源。"""
import inspect
from dataclasses import field, dataclass
from typing import Callable, Annotated

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import InjectedToolArg, tool

from app.domain.results import CapabilityResult
from app.domain.session import SessionContext

ADDRESS_FIELDS = frozenset({"address", "account", "wallet", "owner"})

@dataclass
class TurnContext:
    """一轮对话里，工具共享的东西。通过 config 传引用，不做序列化"""

    ctx: SessionContext
    results: list[CapabilityResult] = field(default_factory=list)


def capability(description: str, render: Callable[[CapabilityResult], str]):
    """强制开发者通过 SessionContext 获取地址，防止地址信息泄露或滥用"""

    def decorator(func: Callable):
        forbidden = ADDRESS_FIELDS & set(inspect.signature(func).parameters)
        if forbidden:
            raise TypeError(
                f"{func.__name__} 的参数里不允许出现地址字段: {sorted(forbidden)}"
            )

        async def run(config: Annotated[RunnableConfig, InjectedToolArg]) -> str:
            turn: TurnContext = config["configurable"]["turn"]
            result: CapabilityResult = await func(turn.ctx)
            if result.capability != func.__name__:
                raise RuntimeError(f"{func.__name__}返回的 capability 是 {result.capability}， 与工具能力 {func.__name__} 不一致")
            turn.results.append(result)
            return render(result)

        run.__name__ = func.__name__
        return tool(run, description=description)

    return decorator
