"""意图兜底段：本地小模型结构化抽取。模型不可用一律返回None，不影响规则段"""
import logging
from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage
from pydantic import BaseModel, create_model
from langchain_ollama import ChatOllama
from app.capabilities.registry import tools
from app.core.config import settings
from app.intent.schema import Intent

logger = logging.getLogger(__name__)

NO_INTENT = "none"

_SYSTEM = """你是意图分类器。判断用户问题属于下列哪个意图，都不属于就输出 none。

{capabilities}"""

def _capability_lines() -> str:
    return "\n".join(
        f"- {item.name}: {item.description}" for item in tools
    )

def _tool_names() -> tuple[str, ...]:
    return tuple(item.name for item in tools)

def _output_model() -> type[BaseModel]:
    """把当前已注册的能力名做成枚举，模型只能在白名单内取值。"""
    names = _tool_names() + (NO_INTENT,)
    return create_model("IntentOutput", capability=(Literal[names], ...))

async def classify(text: str, history: str | None = None) -> Intent | None:
    """规则段没命中时调用。任何失败都返回 None，由调用方继续兜底。"""

    names = _tool_names()
    llm = ChatOllama(
        model=settings.intent_model,
        base_url=settings.ollama_url,
        temperature=0
    )

    messages: list[BaseMessage] = [SystemMessage(content=_SYSTEM.format(capabilities=_capability_lines()))]
    if history:
        messages.append(HumanMessage(content=f"上一轮用户问的是：{history}"))
    else:
        messages.append(HumanMessage(content=f"用户这一轮问题是：{text}"))

    try:
        structured = llm.with_structured_output(_output_model())
        result = await structured.ainvoke(messages)
    except Exception:
        logger.warning("意图模型调用失败，跳过兜底段", exc_info=True)
        return None
    if result.capability == NO_INTENT:
        return None
    if result.capability not in names:
        logger.warning("意图模型输出不在白名单：%r", result.capability)
        return None
    logger.info("意图由模型判定 intent=%s", result.capability)
    return Intent(capability=result.capability, reason="本地模型")
