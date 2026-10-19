"""交易记录：方向判定、金额换算、溯源挂载。数据源用桩替换，不联网。"""

import asyncio

from app.capabilities.render import render_transactions
from app.capabilities.tool import TurnContext
from app.capabilities.transactions import transaction_history
from app.domain.session import SessionContext
from app.providers.explorer import ExplorerProvider

CTX = SessionContext(address="0xde709f2102306220921060314715629080e2fb77")

ROW_IN = {
    "hash": "0xabc",
    "timeStamp": "1700000000",
    "from": "0x1111111111111111111111111111111111111111",
    "to": "0xDE709F2102306220921060314715629080E2FB77",
    "value": "1000000000000000000",
    "blockNumber": "123",
    "isError": "0",
}

ROW_OUT = {**ROW_IN, "hash": "0xdef", "from": ROW_IN["to"], "to": ROW_IN["from"]}


def _call(monkeypatch, rows):
    """按 Agent 的方式调工具：参数为空，上下文走 config 注入。"""

    async def fake_transactions(self, address, limit=20):
        return rows

    monkeypatch.setattr(ExplorerProvider, "transactions", fake_transactions)

    turn = TurnContext(ctx=CTX)
    text = asyncio.run(
        transaction_history.ainvoke({}, config={"configurable": {"turn": turn}})
    )
    return text, turn.results[0]


def test_incoming_direction_and_value(monkeypatch):
    _, result = _call(monkeypatch, [ROW_IN])
    item = result.data["items"][0]
    assert item["direction"] == "in"
    assert item["value"] == "1.0000"
    assert item["status"] == "ok"
    assert result.provenance[0].source == "etherscan-v2"


def test_outgoing_direction(monkeypatch):
    _, result = _call(monkeypatch, [ROW_OUT])
    assert result.data["items"][0]["direction"] == "out"


def test_failed_transaction_is_marked(monkeypatch):
    _, result = _call(monkeypatch, [{**ROW_IN, "isError": "1"}])
    assert result.data["items"][0]["status"] == "failed"


def test_empty_result_renders_without_crashing(monkeypatch):
    text, result = _call(monkeypatch, [])
    assert "没有查到" in text
    assert text == render_transactions(result)


def test_tool_text_is_the_rendered_text(monkeypatch):
    """工具返回的文本就是渲染结果，数字不经模型复述。"""
    text, result = _call(monkeypatch, [ROW_IN])
    assert text == render_transactions(result)
    assert "1.0000 BERA" in text
    assert "转入" in text
    assert "2023-11-14" in text
