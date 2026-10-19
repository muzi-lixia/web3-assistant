"""工具公共基座：运行上下文与参数红线。"""

from dataclasses import field, dataclass
from langchain_core.runnables import RunnableConfig
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext

@dataclass
class TurnContext:
    """一轮对话里，工具共享的东西。通过 config 传引用，不做序列化"""

    ctx: SessionContext
    results: list[CapabilityResult] = field(default_factory=list)

def current_turn(config: RunnableConfig) -> TurnContext:
    return config["configurable"]["turn"]
