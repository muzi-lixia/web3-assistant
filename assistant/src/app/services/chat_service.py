"""对话编排：越权预扫描、意图识别、Agent 执行、答案组装"""
import logging
import time

from langchain_ollama import ChatOllama
from langchain.agents import create_agent
from app.capabilities.registry import tools
from app.capabilities.render import render_balance, render_staking, render_transactions
from app.capabilities.tool import TurnContext
from app.core.config import settings
from app.core.errors import AddressRejected, IntentUnrecognized, FeatureUnavailable
from app.domain.addresses import same_address
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext
from app.intent.classifier import classify
from app.intent.rules import extract_addresses, match, match_followup, refers_to_previous
from app.intent.schema import Intent
from app.repositories.chat_context import ChatContext, chat_context_repo

logger = logging.getLogger(__name__)

_TOOLS = {item.name: item for item in tools}

_RENDERERS = {
    "asset_balance": render_balance,
    "staking_position": render_staking,
    "transaction_history": render_transactions,
}

_AGENT_PROMPT = """你是 Berachain 链上资产助手，只能查询当前登录用户本人的地址。

本轮意图已判定为 {capability}。请直接调用对应工具取数，不要追问地址，不要自己计算或编造任何数字。
工具返回的文本就是最终事实。"""


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


async def resolve(ctx: SessionContext, text: str, conversation_id: str) -> Intent:
    """越权预扫描 → 意图判定。拿到意图就可以先告诉前端。"""

    for raw in extract_addresses(text):
        if not same_address(raw, ctx.address):
            raise AddressRejected()

    previous = await chat_context_repo.get(conversation_id)
    same_user = previous is not None and previous.address == ctx.address
    last_capability = previous.last_capability if same_user else None
    last_question = previous.last_question if same_user else None
    # 上一问题存在，并且匹配代词
    if last_question and refers_to_previous(text):
        intent = await classify(text, history=last_question)
        if intent is None:
            intent = match_followup(text, last_capability)
    else:
        intent = match(text) or await classify(text)

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
    """意图已定，交给 Agent 调工具；答案取工具结果，不经模型复述。"""

    turn = TurnContext(ctx=ctx)
    agent = create_agent(
        _model(),
        tools,
        system_prompt=_AGENT_PROMPT.format(capability=intent.capability),
    )
    await agent.ainvoke(
        {"messages": [("user", text)]},
        config={"configurable": {"turn": turn}, "recursion_limit": 8},
    )

    if not turn.results:
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

    await chat_context_repo.save(
        ChatContext(
            conversation_id=conversation_id,
            last_question=text,
            address=ctx.address,
            last_capability=result.capability,
            expires_at=float(ctx.expires_at or time.time() + 3600)
        )
    )
    return _render(result), result
