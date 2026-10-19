"""金额换算：链上整数与人类可读小数之间的唯一转换点"""
from decimal import ROUND_DOWN, Decimal
WEI_DECIMALS = 18

def from_raw(raw: int, decimals: int = WEI_DECIMALS) -> Decimal:
    """链上整数 -> 展示可用小数，向下截断，避免高报"""

    return (Decimal(raw) / Decimal(10**decimals)).quantize(Decimal("0.0001"), ROUND_DOWN)
