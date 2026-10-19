"""答案渲染：数字从链上到用户，不经过语言模型。"""

from datetime import datetime, timezone
from decimal import Decimal

from app.domain.results import CapabilityResult


def render_balance(result: CapabilityResult) -> str:
    data = result.data
    items = data.get("items", [])
    held = [
        f"{item['amount']} {item['symbol']}"
        for item in items
        if Decimal(item["amount"]) > 0
    ]
    if not held:
        return f"当前地址没有持有资产 (区块高度 {data['block_height']})"

    text = "当前持有 " + "、".join(held)
    if any(item.get("value_usd") is not None for item in items):
        text += f"，合计约 ${data['total_value_usd']}"
    if data.get("valuation_note"):
        text += f"（{data['valuation_note']}）"
    return text + f" (区块高度 {data['block_height']})"


def render_staking(result: CapabilityResult) -> str:
    data = result.data
    position = data["in_position"]
    parts = [f"在押 {position['shares']} sWBERA，约合 {position['equivalent_wbera']} WBERA"]

    claimable = data["claimable"]
    if claimable["items"]:
        parts.append(f"可领取 {claimable['total_assets']} BERA")

    waiting = data["unlocking"]
    if waiting["items"]:
        soonest = min(item["remaining_seconds"] for item in waiting["items"])
        parts.append(
            f"解锁中 {waiting['total_assets']} BERA，最早一笔还需约 {soonest / 86400:.1f} 天"
        )

    if not waiting["items"] and not claimable["items"]:
        parts.append("没有排队中的解锁")

    return "。".join(parts) + f"（区块高度 {data['block_height']}）"


def render_transactions(result: CapabilityResult) -> str:
    data = result.data
    items = data["items"]
    if not items:
        return f"没有查到交易记录（查询范围：最近 {data['limit']} 条）"

    latest = items[0]
    when = datetime.fromtimestamp(latest["timestamp"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M")
    direction = "转入" if latest["direction"] == "in" else "转出"
    state = "成功" if latest["status"] == "ok" else "失败"
    return (
        f"查到 {len(items)} 条交易，最新一条 {when} UTC "
        f"{direction} {latest['value']} BERA，{state}"
    )


