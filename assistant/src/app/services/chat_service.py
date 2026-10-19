"""对话编排：越权预扫描、意图识别、Agent 执行、答案组装"""
import logging
import re
import time
from decimal import Decimal

from langchain.agents import create_agent
from langchain_ollama import ChatOllama

from app.capabilities.registry import tools
from app.capabilities.render import render_balance, render_staking, render_transactions
from app.capabilities.tool import TurnContext
from app.core.config import settings
from app.core.errors import AddressRejected, IntentUnrecognized, FeatureUnavailable
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


def _model() -> ChatOllama:
    return ChatOllama(
        model=settings.intent_model,
        base_url=settings.ollama_url,
        temperature=0,
        async_client_kwargs={"trust_env": False},
    )


def _render(result: CapabilityResult) -> str:
    renderer = _RENDERERS.get(result.capability)
    if renderer is None:
        raise RuntimeError(f"能力 {result.capability} 没有对应渲染器")
    return renderer(result)


def _last_text(state: dict) -> str:
    """取模型最后一条消息的文本。"""
    messages = state.get("messages") or []
    if not messages:
        return ""
    content = messages[-1].content
    if isinstance(content, str):
        return content.strip()
    return "".join(
        part.get("text", "") for part in content if isinstance(part, dict)
    ).strip()


def _grounded(answer: str, facts: str) -> bool:
    """回答里的每个数字都必须能在工具结果里找到，容差 1%。"""
    allowed = [Decimal(item) for item in _NUMBER.findall(facts)]
    for raw in _NUMBER.findall(answer):
        value = Decimal(raw)
        if not any(
            item == value
            or (item != 0 and abs(item - value) / item < Decimal("0.01"))
            for item in allowed
        ):
            return False
    return True


async def resolve(ctx: SessionContext, text: str, conversation_id: str) -> Intent:
    """越权预扫描 → 意图判定。拿到意图就可以先告诉前端。"""

    for raw in extract_addresses(text):
        if not same_address(raw, ctx.address):
            raise AddressRejected()

    previous = await chat_context_repo.get(conversation_id)
    same_user = previous is not None and previous.address == ctx.address
    last_capability = previous.last_capability if same_user else None
    last_question = previous.last_question if same_user else None
    intent = match(text)
    if intent is None:
        history = last_question if (last_question and refers_to_previous(text)) else None
        intent = await classify(text, history=history)
        if intent is None and history:
            intent = match_followup(text, last_capability)

    if intent is None:
        raise IntentUnrecognized()
    if not intent.supported:
        raise FeatureUnavailable()
    return intent


async def run(
    ctx: SessionContext,
    text: str,
    intent: Intent,
    conversation_id: str
) -> tuple[str, CapabilityResult]:
    """意图已定，交给 Agent 调工具；答案由模型组织，数字经校验。"""

    turn = TurnContext(ctx=ctx)
    agent = create_agent(
        _model(),
        tools,
        system_prompt=prompt(AGENT_PROMPT).render(capability=intent.capability),
    )
    state = await agent.ainvoke(
        {"messages": [("user", text)]},
        config={"configurable": {"turn": turn}, "recursion_limit": 8},
    )

    called_tool = bool(turn.results)
    if not called_tool:
        # 模型没调工具时按已判定的意图兜底，不让一次模型失手变成产品故障
        tool_ = _TOOLS.get(intent.capability)
        if tool_ is None:
            raise FeatureUnavailable()
        logger.warning("Agent 未调用工具，按意图兜底执行 capability=%s", intent.capability)
        await tool_.ainvoke({}, config={"configurable": {"turn": turn}})

    result = turn.results[-1]
    if result.capability != intent.capability:
        logger.warning(
            "Agent 实际调用 %s，与意图判定 %s 不一致",
            result.capability,
            intent.capability,
        )

    facts = _render(result)
    answer_text = _last_text(state) if called_tool else ""
    if not answer_text or not _grounded(answer_text, facts):
        logger.warning("模型答案未通过数字校验，退回模板 capability=%s", result.capability)
        answer_text = facts

    await chat_context_repo.save(
        ChatContext(
            conversation_id=conversation_id,
            last_question=text,
            address=ctx.address,
            last_capability=result.capability,
            expires_at=float(ctx.expires_at or time.time() + 3600),
        )
    )
    return answer_text, result
