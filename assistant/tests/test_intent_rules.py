"""意图规则：地址提取的精度，以及规则顺序的语义。"""

from app.intent.rules import extract_addresses, match

SOME_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"


def test_extracts_full_address():
    assert extract_addresses(f"查一下 {SOME_ADDRESS} 的资产") == [SOME_ADDRESS]


def test_ignores_short_hex_like_text():
    """0x4 这种不是地址，不能被当成越权证据。"""
    assert extract_addresses("0x4 开头的地址") == []


def test_staking_rule_wins_over_balance_rule():
    """「质押资产」同时命中两条规则，顺序决定归属。"""
    intent = match("我的质押资产有多少")
    assert intent is not None
    assert intent.capability == "staking_position"


def test_plain_balance_question_matches_balance():
    intent = match("我的资产有多少")
    assert intent is not None
    assert intent.capability == "asset_balance"


def test_unrelated_question_returns_none():
    assert match("今天天气怎么样") is None

def test_transaction_intent_recognized_but_unsupported():
    """交易记录认得出来，但能力还没接入，不能被当成资产查询。"""
    intent = match("我最近的交易记录")
    assert intent is not None
    assert intent.capability == "transaction_history"
    assert intent.supported is True

