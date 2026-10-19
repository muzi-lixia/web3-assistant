"""会话上下文：一次请求里已被证明的身份。"""
from dataclasses import dataclass

@dataclass(frozen=True)
class SessionContext:
    """地址只能从这里来。能力层拿不到任何客户端传入的地址"""

    address: str
    expires_at: int = 0