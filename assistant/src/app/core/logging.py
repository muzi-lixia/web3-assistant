"""日志：统一格式+地址脱敏。所有输出日志必须经过这里"""

import logging
import re

_ADDRESS_RE = re.compile(r"0x[a-fA-F0-9]{40}")

def mask_address(address: str) -> str:
    if len(address) < 12:
        return address
    return f"{address[:16]}...{address[-4:]}"

class AddressMaskFilter(logging.Filter):
    """把消息里出现的完整地址替换成脱敏形式"""

    def filter(self, record: logging.LogRecord) -> bool:
        message = _ADDRESS_RE.sub(lambda match: mask_address(match.group(0)), record.getMessage())
        record.msg = message
        record.args = ()
        return True

def setup_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )
    handler.addFilter(AddressMaskFilter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

