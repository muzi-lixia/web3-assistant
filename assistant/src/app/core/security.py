"""签名验签：从EIP-4361 消息与签名中恢复出签名者地址"""
import re
import secrets
from datetime import timezone, datetime, timedelta

import jwt
from eth_account import Account
from eth_account.messages import encode_defunct

from app.core.config import settings
from app.domain.normalization import is_validate_address, normalize_address


class SignatureError(Exception):
    """签名或消息不合法，无法得到可信的地址"""


_NONCE_RE = re.compile(r"^Nonce: (.+)$", re.MULTILINE)


def extract_nonce(message: str) -> str:
    """从message中取出nonce"""

    match = _NONCE_RE.search(message)
    if match is None:
        raise SignatureError("消息中缺少Nonce字段")
    return match.group(1).strip()

def recover_address(message: str, signature: str) -> str:
    """从消息中恢复出address"""

    if not signature.startswith("0x"):
        signature = "0x" + signature
    try:
        #  encode_defunct(text=message)必须和签名时用的一模一样
        recovered = Account.recover_message(
            encode_defunct(text=message),
            signature=signature
        )
    except (ValueError, TypeError) as exc:
        raise SignatureError("签名格式非法") from exc
    if not is_validate_address(recovered):
        raise SignatureError("签名地址无法恢复出合法地址")
    return normalize_address(recovered)


class TokenError(Exception):
    """令牌确实、过期或签名不合法"""

def create_access_token(address: str) -> tuple[str, int]:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": normalize_address(address),
        "jti": secrets.token_hex(8),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=settings.jwt_ttl_seconds)).timestamp())
    }

    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

    return token, settings.jwt_ttl_seconds

def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise TokenError("令牌无效或已过期") from exc




