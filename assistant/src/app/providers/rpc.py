"""Berachain JSON-RPC 客户端：只读，不做任何签名或交易。"""
from decimal import Decimal, ROUND_DOWN

import httpx

from app.core.errors import DatasourceTimeout, DatasourceUnavailable, RateLimited
from app.domain.money import from_raw


class RpcError(Exception):
    """RPC 返回错误或网络失败。"""

class BerachainRpc:
    def __init__(self, url: str, timeout: float = 10.0) -> None:
        self._url = url
        self._timeout = timeout

    async def _call(self, method: str, params: list) -> str:
        payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(self._url, json=payload)
                response.raise_for_status()
                body = response.json()
        except httpx.TimeoutException as exc:
            raise DatasourceTimeout(str(exc)) from exc
        except httpx.HTTPError as exc:
            raise DatasourceUnavailable(str(exc)) from exc
        if response.status_code == 429:
            raise RateLimited(f"HTTP 429 from {self._url}")

        if response.status_code >= 400:
            raise DatasourceUnavailable(f"HTTP {response.status_code}")

        try:
            body = response.json()
        except ValueError as exc:
            raise DatasourceUnavailable("RPC 返回非 JSON") from exc

        if "error" in body:
            raise DatasourceUnavailable(str(body["error"]))

        return body["result"]

    async def block_number(self) -> int:
        raw = await self._call("eth_blockNumber", [])
        return int(raw, 16)

    async def native_balance(self, address: str) -> Decimal:
        raw = await self._call("eth_getBalance", [address, "latest"])
        return from_raw(int(raw, 16))

    async def convert_to_assets(self, vault: str, shares: int) -> int:
        """ERC-4626: 份额、对应资产数量（原始整数）"""

        data = "0x07a2d13a" + format(shares, "064x")
        raw = await self._call("eth_call", [{"to": vault, "data": data}, "latest"])
        if not raw or raw == "0x":
            raise DatasourceUnavailable(f"{vault} 无返回数据")
        return int(raw, 16)

    async def erc20_balance(self, token: str, owner: str) -> int:
        """返回链上原始整数，不做小数转换"""
        data = "0x70a08231" + owner.lower().removeprefix("0x").rjust(64, "0")
        raw = await self._call("eth_call", [{"to": token, "data": data}, "latest"])
        if not raw or raw == "0x":
            raise DatasourceUnavailable(f"{token} 无返回数据")
        return int(raw, 16)