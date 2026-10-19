"""对话编排：越权预扫描、意图识别、Agent 执行、答案组装"""
import logging
import re
import time
from collections.abc import AsyncIterator
from decimal import Decimal
from typing import Any

from langchain.agents import create_agent
from langchain_ollama import ChatOllama

from app.capabilities.registry import tools
from app.capabilities.render import render_balance, render_staking, render_transactions
from app.capabilities.tool import TurnContext
from app.core.config import settings
from app.core.errors import AddressRejected, IntentUnrecognized, FeatureUnavailable
from app.core.logging import log_context, span
from app.domain.addresses import same_address
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext
from app.intent.classifier import CLASSIFY_PROMPT, classify
from app.intent.rules import extract_addresses, match, match_followup, refers_to_previous
from app.intent.schema import Intent
from app.prompts import prompt
from app.repositories.chat_context import ChatContext, chat_context_repo

logger = logging.getLogger(__name__)

AGENT_PROMPT = "agent_v1"

_TOOLS = {item.name: item for item in tools}

_RENDERERS = {
    "asset_balance": render_balance,
    "staking_position": render_staking,
    "transaction_history": render_transactions,
}

_NUMBER = re.compile(r"\d+(?:\.\d+)?")
_ADDRESS = re.compile(r"0x[0-9a-fA-F]{6,}")
_PERCENT = re.compile(r"\d+(?:\.\d+)?\s*%")
_SENTENCE_END = re.compile(r"[。！？；!?;\n]")
_TOLERANCE = Decimal("0.01")
# 小于这个值的整数按条数、序号处理，不参与核对
_COUNT_LIMIT = Decimal(100)

_MODEL = ChatOllama(
    model=settings.intent_model,
    base_url=settings.ollama_url,
    temperature=0,
    async_client_kwargs={
        "trust_env": False,
        "timeout": settings.model_timeout_seconds,
    },
)

def _render(result: CapabilityResult) -> str:
    renderer = _RENDERERS.get(result.capability)
    if renderer is None:
        raise RuntimeError(f"能力 {result.capability} 没有对应渲染器")
    return renderer(result)


def _text_of(message: Any) -> str:
    """从流式消息块里取正文。工具调用块没有正文，取出来是空串。"""
    content = message.content
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            part.get("text", "") for part in content if isinstance(part, dict)
        )
    return ""


def _head(buffer: str) -> int:
    """返回第一个句末标点之后的位置，没有句末返回 0。"""
    match = _SENTENCE_END.search(buffer)
    return match.end() if match else 0


def _offender(answer: str, facts: str) -> str | None:
    """返回第一个对不上的数字，全部对得上返回 None。

    地址和百分比不参与核对：地址里全是数字，百分比是模型自己做的一次换算。
    带小数的数值按 1% 容差比对；整数要求能由工具结果的数值取整得到，
    小于 100 的整数当作条数、序号放过。
    """

    allowed = [Decimal(item) for item in _NUMBER.findall(facts)]
    rounded = {round(item) for item in allowed}
    text = _PERCENT.sub(" ", _ADDRESS.sub(" ", answer))

    for raw in _NUMBER.findall(text):
        value = Decimal(raw)
        if "." not in raw:
            if value < _COUNT_LIMIT or value in rounded:
                continue
            return raw
        if any(
            item == value
            or (item != 0 and abs(item - value) / item < _TOLERANCE)
            for item in allowed
        ):
            continue
        return raw
    return None


async def resolve(ctx: SessionContext, text: str, conversation_id: str) -> Intent:
    """越权预扫描 → 意图判定。拿到意图就可以先告诉前端。"""

    for raw in extract_addresses(text):
        if not same_address(raw, ctx.address):
            raise AddressRejected()

    with log_context(conversation_id=conversation_id), span(
        "intent.resolved"
    ) as outcome:
        previous = await chat_context_repo.get(conversation_id, ctx.address)
        last_capability = previous.last_capability if previous else None
        last_question = previous.last_question if previous else None
        source = "rule"
        intent = match(text)
        if intent is None:
            history = (
                last_question if (last_question and refers_to_previous(text)) else None
            )
            intent = await classify(text, history=history)
            source = "model"
            if intent is None and history:
                intent = match_followup(text, last_capability)
                source = "followup"

        if intent is None:
            raise IntentUnrecognized()
        if not intent.supported:
            raise FeatureUnavailable()
        outcome["capability"] = intent.capability
        outcome["source"] = source
        return intent


def _history_note(conversation: ChatContext | None) -> str:
    """把最近几轮问句拼成一条前置说明。只放提问，不放助手回答。

    助手的回答里全是当时的链上数值，送进模型就会被复述，而数字校验只认本轮
    工具结果，复述旧余额会让整段答案被判成编造。指代消解只需要用户问过什么。
    """
    if conversation is None or not conversation.recent_questions:
        return ""
    lines = "\n".join(
        f"{index}. {question}"
        for index, question in enumerate(conversation.recent_questions, 1)
    )
    return (
        "【历史提问，仅用于理解指代。其中提到的数据已过期，必须重新取数，"
        "不可当作当前事实。】\n" + lines
    )


async def run_stream(
    ctx: SessionContext,
    text: str,
    intent: Intent,
    conversation_id: str,
    client_msg_id: str | None = None,
) -> AsyncIterator[tuple[str, Any]]:
    """意图已定，交给 Agent 调工具；答案边生成边下发，数字逐句校验。

    依次产出：
      delta  一段已通过数字校验的答案文本
      answer 答案全文，模型未能给出合规答案时为空串
      calls  本轮全部工具调用结果
    """

    # 历史要在本轮写入之前取，否则这个问句会把自己也算进历史
    conversation = await chat_context_repo.get(conversation_id, ctx.address)
    recorded = await chat_context_repo.append(conversation_id, ctx.address, "user", text, client_msg_id=client_msg_id)
    if not recorded:
        yield ("duplicate", {})
        return
    history = _history_note(conversation)
    turn = TurnContext(ctx=ctx)
    agent = create_agent(
        _MODEL,
        tools,
        system_prompt=prompt(AGENT_PROMPT).render(capability=intent.capability),
    )

    facts = ""
    rendered = 0
    buffer = ""
    parts: list[str] = []
    blocked = False
    calls_seen: set[str] = set()
    pending: list[dict] = []

    messages: list[tuple[str, str]] = []
    if history:
        messages.append(("user", history))
    messages.append(("user", text))

    async for mode, chunk in agent.astream(
        {"messages": messages},
        config={"configurable": {"turn": turn}, "recursion_limit": 8},
        stream_mode=["messages", "values"],
    ):
        if mode == "values":
            # 每条 values 都带完整历史，按 tool_call id 去重
            for message in chunk.get("messages") or []:
                for call in getattr(message, "tool_calls", None) or []:
                    if call["id"] in calls_seen:
                        continue
                    calls_seen.add(call["id"])
                    pending.append(
                        {"name": call["name"], "arguments": call.get("args") or {}}
                    )
            continue
        message, meta = chunk
        if meta.get("langgraph_node") != "model":
            continue
        # 工具还没执行完时，模型说的话是在选工具，不是答案
        if not turn.results:
            continue
        if len(turn.results) > rendered:
            # 历史问句里的数字是用户自己给的，复述它不算编造
            facts = "\n".join([history, *(_render(item) for item in turn.results)])
            rendered = len(turn.results)

        buffer += _text_of(message)
        while (cut := _head(buffer)):
            segment, buffer = buffer[:cut], buffer[cut:]
            number = _offender(segment, facts)
            if number is not None:
                blocked = True
                logger.warning(
                    "turn.blocked",
                    extra={
                        "conversation_id": conversation_id,
                        "capability": intent.capability,
                        "stage": "number_check",
                    },
                )
                break
            parts.append(segment)
            yield ("delta", {"text": segment})
        if blocked:
            break

    if not blocked and buffer:
        number = _offender(buffer, facts)
        if number is None:
            parts.append(buffer)
            yield ("delta", {"text": buffer})
        else:
            blocked = True
            logger.warning(
                "turn.blocked",
                extra={
                    "conversation_id": conversation_id,
                    "capability": intent.capability,
                    "stage": "number_check_tail",
                },
            )

    if not turn.results:
        # 模型没调工具时按已判定的意图兜底，不让一次模型失手变成产品故障
        tool_ = _TOOLS.get(intent.capability)
        if tool_ is None:
            raise FeatureUnavailable()
        logger.warning(
            "turn.fallback",
            extra={
                "conversation_id": conversation_id,
                "capability": intent.capability,
            },
        )
        await tool_.ainvoke({}, config={"configurable": {"turn": turn}})

    result = turn.results[-1]
    if result.capability != intent.capability:
        logger.warning(
            "intent.mismatch",
            extra={
                "conversation_id": conversation_id,
                "capability": intent.capability,
                "tool": result.capability,
            },
        )

    answer_text = "" if blocked else "".join(parts)

    # 工具入参来自模型真实的调用，按工具名配对；失败的调用不在 results 里，不能按下标配对
    for item in turn.results:
        for slot in pending:
            if slot["name"] == item.capability and not slot.get("used"):
                item.arguments = slot["arguments"]
                slot["used"] = True
                break

    yield ("answer", {"text": answer_text})
    yield ("calls", turn.results)

    await chat_context_repo.append(
        conversation_id,
        ctx.address,
        "assistant",
        answer_text,
        capability=result.capability,
    )

