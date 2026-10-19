"""Etherscan V2 兼容接口：只读查交易列表。"""
import re

import httpx

from app.core.errors import DatasourceTimeout, DatasourceUnavailable, RateLimited
from app.providers.http import client

_BASE_URL = "https://api.etherscan.io/v2/api"
_API_KEY_RE = re.compile(r"apikey=[^&\s]*", re.IGNORECASE)


def _safe(text: str) -> str:
    """错误体里可能带上原始请求串，密钥不能跟着进日志。"""
    return _API_KEY_RE.sub("apikey=***", text)


class ExplorerProvider:
    def __init__(self, api_key: str, chain_id: int, timeout: float = 10.0) -> None:
        self._api_key = api_key
        self._chain_id = chain_id
        self._timeout = timeout

    async def _get(self, params: dict) -> list[dict]:
        query = {"chainid": self._chain_id, "apikey": self._api_key, **params}
        try:
            response = await client().get(_BASE_URL, params=query, timeout=self._timeout)
        except httpx.TimeoutException as exc:
            raise DatasourceTimeout(str(exc)) from exc
        except httpx.HTTPError as exc:
            raise DatasourceUnavailable(str(exc)) from exc

        if response.status_code == 429:
            raise RateLimited(f"HTTP 429 from {_BASE_URL}")

        if response.status_code >= 400:
            raise DatasourceUnavailable(f"HTTP {response.status_code}")

        try:
            body = response.json()
        except ValueError as exc:
            raise DatasourceUnavailable("交易接口返回非 JSON") from exc

        if body.get("status") == "0":
            message = str(body.get("message", ""))
            if message == "No transactions found":
                return []
            if "rate limit" in message.lower():
                raise RateLimited(_safe(message))
            raise DatasourceUnavailable(_safe(f"{message}: {body.get('result')}"))

        result = body.get("result")
        return result if isinstance(result, list) else []

    async def transactions(self, address: str, limit: int = 20) -> list[dict]:
        return await self._get({
            "module": "account",
            "action": "txlist",
            "address": address,
            "page": 1,
            "offset": limit,
            "sort": "desc",
        })
