"""交易记录：方向判定、金额换算、溯源挂载。数据源用桩替换，不联网。"""

import asyncio

from app.capabilities.transactions import TransactionHistoryCapability, TransactionParams
from app.domain.session import SessionContext
from app.services import chat_service

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


def _run(monkeypatch, rows):
    async def fake_transactions(self, address, limit=20):
        return rows

    monkeypatch.setattr(
        "app.providers.explorer.ExplorerProvider.transactions", fake_transactions
    )
    return asyncio.run(
        TransactionHistoryCapability().execute(CTX, TransactionParams())
    )


def test_incoming_direction_and_value(monkeypatch):
    result = _run(monkeypatch, [ROW_IN])
    item = result.answer["items"][0]
    assert item["direction"] == "in"
    assert item["value"] == "1.0000"
    assert item["status"] == "ok"
    assert result.provenance[0].source == "etherscan-v2"


def test_outgoing_direction(monkeypatch):
    result = _run(monkeypatch, [ROW_OUT])
    assert result.answer["items"][0]["direction"] == "out"


def test_failed_transaction_is_marked(monkeypatch):
    result = _run(monkeypatch, [{**ROW_IN, "isError": "1"}])
    assert result.answer["items"][0]["status"] == "failed"


def test_empty_result_renders_without_crashing(monkeypatch):
    result = _run(monkeypatch, [])
    text = chat_service._render_transactions(result)
    assert "没有查到" in text


def test_rendered_text_carries_amount_and_time(monkeypatch):
    result = _run(monkeypatch, [ROW_IN])
    text = chat_service._render_transactions(result)
    assert "1.0000 BERA" in text
    assert "转入" in text
    assert "2023-11-14" in text
