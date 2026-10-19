"""对话编排：越权预扫描、意图识别、能力执行、答案组装"""
import time
from datetime import datetime, timezone
from decimal import Decimal

from app.capabilities.registry import registry
from app.core.errors import AddressRejected, IntentUnrecognized, FeatureUnavailable
from app.domain.normalization import same_address
from app.domain.results import CapabilityResult
from app.domain.session import SessionContext
from app.intent.model import classify
from app.intent.rules import extract_addresses, match, match_followup, Intent, refers_to_previous
from app.repositories.chat_context import ChatContext, chat_context_repo


class AddressRejectedError(Exception):
    """提问中包含他人地址"""

class IntentUnRecognizedError(Exception):
    """意图未命中"""

REJECTION_MESSAGE = "我只能查询你当前登录钱包的地址，无法查询其他地址。"
FALLBACK_MESSAGE = "我可以帮你查询资产余额、交易记录和质押情况。你可以换个问法试试。"

def _render_balance(result: CapabilityResult) -> str:
    answer = result.answer
    items = answer.get("items", [])
    held = [
        f"{item['amount']} {item['symbol']}"
        for item in items
        if Decimal(item['amount']) > 0
    ]

    if not held:
        return f"当前地址没有持有资产 (区块高度 {answer['block_height']})"

    text = "当前持有 " + "、".join(held)
    text += f"，合计约 ${answer['total_value_usd']}"
    if answer.get("valuation_note"):
        text += f"（{answer['valuation_note']}）"
    return text + f" (区块高度 {answer['block_height']})"


def _render_staking(result: CapabilityResult) -> str:
    answer = result.answer
    position = answer['in_position']
    text = (
        f"在押 {position['shares']} sWBERA"
        f", 约合 {position['equivalent_wbera']} sWBERA"
        f"（区块高度 {answer['block_height']}）"
    )
    if not answer["unlocking"]["available"]:
        text += "。解锁队列数据暂不可得"
    return text

def _render_transactions(result: CapabilityResult) -> str:
    answer = result.answer
    items = answer["items"]
    if not items:
        return f"没有查到交易记录（查询范围：最近 {answer['limit']} 条）"

    latest = items[0]
    when = datetime.fromtimestamp(latest["timestamp"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M")
    direction = "转入" if latest["direction"] == "in" else "转出"
    state = "成功" if latest["status"] == "ok" else "失败"
    return (
        f"查到 {len(items)} 条交易，最新一条 {when} UTC "
        f"{direction} {latest['value']} BERA，{state}"
    )


_RENDERERS = {
    "asset_balance": _render_balance,
    "staking_position": _render_staking,
    "transaction_history": _render_transactions,
}

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
    """意图已定，执行能力并返回渲染好的答案。"""

    capability = registry.get(intent.capability)
    result = await capability.execute(ctx, capability.input_model())

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


async def answer(
    ctx: SessionContext,
    text: str,
    conversation_id: str
) -> tuple[str, CapabilityResult]:
    """两步合一，测试和内部调用用这个。"""

    intent = await resolve(ctx, text, conversation_id)
    return await run(ctx, text, intent, conversation_id)



