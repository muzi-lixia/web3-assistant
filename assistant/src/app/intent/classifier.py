"""意图兜底段：本地小模型结构化抽取。模型不可用一律返回None，不影响规则段"""
import logging
from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage
from pydantic import create_model
from langchain_ollama import ChatOllama
from app.capabilities.registry import tools
from app.core.config import settings
from app.intent.schema import Intent
from app.prompts import prompt

logger = logging.getLogger(__name__)

NO_INTENT = "none"

CLASSIFY_PROMPT = "classify_v1"
_SYSTEM = prompt(CLASSIFY_PROMPT).render(
    capabilities=[(item.name, item.description) for item in tools]
)

def _tool_names() -> tuple[str, ...]:
    return tuple(item.name for item in tools)


_NAMES = _tool_names()
# 能力名在进程内不变，枚举模型只建一次
_OUTPUT_MODEL = create_model(
    "IntentOutput", capability=(Literal[_NAMES + (NO_INTENT,)], ...)
)

_LLM = ChatOllama(
    model=settings.intent_model,
    base_url=settings.ollama_url,
    temperature=0,
    async_client_kwargs={
        "trust_env": False,
        "timeout": settings.model_timeout_seconds,
    },
)

async def classify(text: str, history: str | None = None) -> Intent | None:
    """规则段没命中时调用。任何失败都返回 None，由调用方继续兜底。"""

    messages: list[BaseMessage] = [SystemMessage(content=_SYSTEM)]
    if history:
        messages.append(HumanMessage(content=f"上一轮用户问的是：{history}\n这一轮用户问的是：{text}"))
    else:
        messages.append(HumanMessage(content=f"用户这一轮问题是：{text}"))

    try:
        structured = _LLM.with_structured_output(_OUTPUT_MODEL)
        result = await structured.ainvoke(messages)
    except Exception:
        logger.warning("意图模型调用失败，跳过兜底段", exc_info=True)
        return None
    if result.capability == NO_INTENT:
        return None
    if result.capability not in _NAMES:
        logger.warning("意图模型输出不在白名单：%r", result.capability)
        return None
    logger.info("意图由模型判定 intent=%s", result.capability)
    return Intent(capability=result.capability, reason="本地模型")
