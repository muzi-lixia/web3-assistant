"""地址归一化与校验：全项目唯一的地址格式处理实现点。"""
from eth_utils import is_address, to_checksum_address

class AddressError(ValueError):
    """地址格式非法"""

def is_validate_address(raw: object) -> bool:
    """判断是否为合法地址，不抛异常，供外部输入过滤使用。"""

    if not isinstance(raw, str):
        return False
    return is_address(raw)

def normalize_address(raw: str) -> str:
    """转成小写，用于存储和比较。"""

    if not is_validate_address(raw):
        raise AddressError(f"Invalid address: {raw}")
    return raw.lower()

def to_display_address(raw: str) -> str:
    """转成 EIP-55 校验和形式，用于给用户看。"""

    if not is_validate_address(raw):
        raise AddressError(f"Invalid address: {raw}")
    return to_checksum_address(raw)


def same_address(left: str, right: str) -> bool:
    """比较两个地址是否相同；任一非法直接返回 False。"""

    if not (is_validate_address(left) and is_validate_address(right)):
        return False
    return normalize_address(left) == normalize_address(right)

