"""意图规则：纯本地正则，不访问网络。未命中返回 None。"""
import re
from app.intent.schema import Intent

_ADDRESS_RE = re.compile(r"0x[a-fA-F0-9]{40}")
_ANAPHORA_RE = re.compile(r"那|呢|它|这个|那个|还有|继续")

_RULES: tuple[tuple[re.Pattern[str], str, bool], ...] = (
    (re.compile(r"质押|staking|sWBERA", re.IGNORECASE), "staking_position", True),
    (re.compile(r"资产|余额|持仓|多少钱|balance", re.IGNORECASE), "asset_balance", True),
    (re.compile(r"交易|转账|流水|transaction", re.IGNORECASE), "transaction_history", True),
)

def extract_addresses(text: str) -> list[str]:
    """抽出文本中出现的所有地址，供越权预扫描使用"""
    return _ADDRESS_RE.findall(text)

def match(text: str) -> Intent | None:
    for pattern, capability, supported in _RULES:
        if pattern.search(text):
            return Intent(capability=capability, reason=f"命中规则 {pattern.pattern}", supported=supported)
    return None

def match_followup(text: str, last_capability: str | None) -> Intent | None:
    """没命中规则、但句子里有指代词时，沿用上一轮的能力。"""
    if last_capability is None:
        return None
    if _ANAPHORA_RE.search(text):
        return Intent(capability=last_capability, reason="承接上一轮")
    return None

def refers_to_previous(text: str) -> bool:
    """句子里带指代词，答案依赖上一轮。"""
    return bool(_ANAPHORA_RE.search(text))

