"""JSON 日志与请求关联。只输出白名单字段，不记录正文、地址与凭证。"""

import json
import logging
import re
import sys
import time
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from uuid import uuid4

trace_id = ContextVar("trace_id", default="")
span_id = ContextVar("span_id", default="")
parent_span_id = ContextVar("parent_span_id", default="")
operation_fields = ContextVar("operation_fields", default=None)
service_name = ContextVar("service", default="assistant")

FIELDS = frozenset(
    {
        "conversation_id",
        "capability",
        "source",
        "tool",
        "model",
        "provider",
        "duration_ms",
        "first_token_ms",
        "status",
        "error_code",
        "http_status",
        "method",
        "route",
        "result_count",
        "stage",
        "exception_type",
    }
)

_EVENT_RE = re.compile(r"[a-z][a-z0-9_.]{0,80}")


class JsonFormatter(logging.Formatter):
    """把日志记录渲染成单行 JSON，只保留白名单字段。

    字符串一旦超长或含地址、令牌、URL 就整条丢弃——宁可少记，也不冒把敏感数据
    写进日志的风险。异常只记类型与代码位置，不落原文。
    """

    def format(self, record: logging.LogRecord) -> str:
        event = str(record.msg)
        if not _EVENT_RE.fullmatch(event):
            event = "application.log"
        body: dict[str, object] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": service_name.get(),
            "event": event,
            "logger": record.name,
            "trace_id": trace_id.get(),
            "span_id": span_id.get(),
            "parent_span_id": parent_span_id.get(),
        }
        for key in FIELDS:
            value = getattr(record, key, (operation_fields.get() or {}).get(key))
            if isinstance(value, (str, int, float, bool)):
                if isinstance(value, str) and (
                    len(value) > 160
                    or "0x" in value
                    or "Bearer " in value
                    or "://" in value
                ):
                    continue
                body[key] = value
        if record.exc_info and record.exc_info[0]:
            body["exception_type"] = record.exc_info[0].__name__
            frames, tb = [], record.exc_info[2]
            while tb:
                code = tb.tb_frame.f_code
                frames.append(
                    {
                        "file": Path(code.co_filename).name,
                        "function": code.co_name,
                        "line": tb.tb_lineno,
                    }
                )
                tb = tb.tb_next
            body["stack"] = frames[-12:]
        return json.dumps(body, ensure_ascii=False)


def setup_logging(level: int = logging.INFO, log_dir: str | Path | None = None) -> None:
    """同时写 stdout 与有界文件；不给 log_dir 就只写 stdout。"""

    formatter = JsonFormatter()
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]

    if log_dir is not None:
        directory = Path(log_dir)
        directory.mkdir(parents=True, exist_ok=True)
        # 有上限才不会写满磁盘：单文件 20MB × 6 份
        handlers.append(
            RotatingFileHandler(
                directory / "app.log",
                maxBytes=20 * 1024 * 1024,
                backupCount=5,
                encoding="utf-8",
            )
        )

    for handler in handlers:
        handler.setFormatter(formatter)
    root = logging.getLogger()
    root.handlers[:] = handlers
    root.setLevel(level)
    # 这些库按请求或按 token 逐条输出，对定位业务问题没有帮助
    for name in (
        "httpx",
        "httpx2",  # langsmith 用这个 fork，logger 名独立
        "httpcore",
        "urllib3",
        "uvicorn.access",
        "langchain",
        "langgraph",
        "langsmith",
    ):
        logging.getLogger(name).setLevel(logging.CRITICAL)


@contextmanager
def span(event: str, **fields):
    """子阶段沿用 trace_id；退出时记录耗时与状态，异常只留安全错误码。"""
    parent = parent_span_id.set(span_id.get())
    current = span_id.set(uuid4().hex[:16])
    started = time.monotonic()
    outcome: dict[str, object] = {"status": "success", "error_code": None}
    try:
        yield outcome
    except BaseException as exc:
        outcome["status"] = (
            "cancelled" if type(exc).__name__ == "CancelledError" else "failed"
        )
        outcome["error_code"] = getattr(exc, "code", type(exc).__name__)
        raise
    finally:
        logging.getLogger(__name__).info(
            event,
            extra={
                **fields,
                **outcome,
                "duration_ms": round((time.monotonic() - started) * 1000, 2),
            },
        )
        span_id.reset(current)
        parent_span_id.reset(parent)


@contextmanager
def log_context(**fields):
    """让异步子任务沿用受控关联字段，退出时恢复。"""
    token = operation_fields.set({**(operation_fields.get() or {}), **fields})
    try:
        yield
    finally:
        operation_fields.reset(token)


class TraceMiddleware:
    """纯 ASGI 中间件，不缓冲 SSE；流结束后才记整段请求耗时。"""

    def __init__(self, app, service: str = "assistant"):
        self.app, self.service = app, service

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        # 上游 trace 头先校验格式，不合规就本地新生成，防止被注入任意值
        incoming = headers.get(b"x-trace-id", b"").decode("ascii", errors="ignore")
        parent = headers.get(b"x-parent-span-id", b"").decode("ascii", errors="ignore")
        tokens = [
            (
                trace_id,
                trace_id.set(
                    incoming
                    if re.fullmatch(r"[a-f0-9]{32}", incoming)
                    else uuid4().hex
                ),
            ),
            (span_id, span_id.set(uuid4().hex[:16])),
            (
                parent_span_id,
                parent_span_id.set(
                    parent if re.fullmatch(r"[a-f0-9]{16}", parent) else ""
                ),
            ),
            (service_name, service_name.set(self.service)),
        ]
        started, status = time.monotonic(), 500

        async def traced_send(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                message["headers"] = [
                    *message.get("headers", []),
                    (b"x-trace-id", trace_id.get().encode()),
                ]
            await send(message)

        try:
            await self.app(scope, receive, traced_send)
        finally:
            # SSE 结束时才触发，这条代表请求真正收尾
            logging.getLogger(__name__).info(
                "http.completed",
                extra={
                    "method": scope["method"],
                    "route": getattr(scope.get("route"), "path", "unmatched"),
                    "http_status": status,
                    "duration_ms": round((time.monotonic() - started) * 1000, 2),
                },
            )
            for variable, token in reversed(tokens):
                variable.reset(token)
