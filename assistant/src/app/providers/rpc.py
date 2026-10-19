"""Berachain JSON-RPC 客户端：只读，不做任何签名或交易。"""
from decimal import Decimal
from typing import Any

import httpx

from app.core.errors import DatasourceTimeout, DatasourceUnavailable, RateLimited
from app.domain.money import from_raw

_client: httpx.AsyncClient | None = None

def _http(timeout: float) -> httpx.AsyncClient:
    """进程内复用一条连接池，避免每次请求重做 TCP + TLS握手"""

    global _client
    if _client is None:
        # 本机 HTTP_PROXY 会把 RPC 请求也转给代理，每次多 0.27s
        _client = httpx.AsyncClient(timeout=timeout, trust_env=False)
    assert _client is not None
    return _client

async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None

def _balance_of_data(owner: str) -> str:
    return "0x70a08231" + owner.lower().removeprefix("0x").rjust(64, "0")

def _convert_to_assets_data(shares: int) -> str:
    return "0x07a2d13a" + format(shares, "064x")

def _request_ids_data(owner: str) -> str:
    return "0xabc38a78" + owner.lower().removeprefix("0x").rjust(64, "0")


def _request_data(request_id: int) -> str:
    return "0xbecbcaff" + format(request_id, "064x")

def _data(raw: str, target: str) -> str:
    """链上返回值。空数据说明调用打错了，不能当成 0。"""

    if not raw or raw == "0x":
        raise DatasourceUnavailable(f"{target} 无返回数据")
    return raw

def _decode_ids(raw: str) -> list[int]:
    """uint256[] 返回值：偏移、长度、各元素。偏移按字节算，切 hex 要乘 2。"""

    body = raw.removeprefix("0x")
    offset = int(body[0:64], 16) * 2
    length = int(body[offset:offset + 64], 16)
    start = offset + 64
    return [int(body[start + i * 64:start + (i + 1) * 64], 16) for i in range(length)]

def _decode_request(raw: str) -> dict:
    body = raw.removeprefix("0x")
    return {
        "assets": int(body[0:64], 16),
        "shares": int(body[64:128], 16),
        "request_time": int(body[128:192], 16),
        "owner": "0x" + body[192 + 24:256],
        "receiver": "0x" + body[256 + 24:320],
    }

class BerachainRpc:
    def __init__(self, url: str, timeout: float = 10.0) -> None:
        self._url = url
        self._timeout = timeout

    async def _post(self, payload: Any) -> Any:
        try:
            response = await _http(self._timeout).post(self._url, json=payload)
        except httpx.TimeoutException as exc:
            raise DatasourceTimeout(str(exc)) from exc
        except httpx.HTTPError as exc:
            raise DatasourceUnavailable(str(exc)) from exc

        if response.status_code == 429:
            raise RateLimited(f"HTTP 429 from {self._url}")

        if response.status_code >= 400:
            raise DatasourceUnavailable(f"HTTP {response.status_code}")

        try:
            return response.json()
        except ValueError as exc:
            raise DatasourceUnavailable("RPC 返回非 JSON") from exc

    async def _call(self, method: str, params: list) -> Any:
        body = await self._post(
            {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
        )
        if "error" in body:
            raise DatasourceUnavailable(str(body["error"]))
        return body["result"]

    async def _batch(self, calls: list[tuple[str, list]]) -> list[Any]:
        """一次 HTTP 发出多个调用，按传入顺序返回。

        公共网关对并发请求会限流，一次 batch 由服务端内部并行处理，
        比 asyncio.gather 又快又稳。
        """

        payload = [
            {"jsonrpc": "2.0", "id": index, "method": method, "params": params}
            for index, (method, params) in enumerate(calls)
        ]
        body = await self._post(payload)
        if not isinstance(body, list):
            raise DatasourceUnavailable("RPC 端点不支持批量调用")

        by_id = {item.get("id"): item for item in body if isinstance(item, dict)}
        results: list[Any] = []
        for index in range(len(calls)):
            item = by_id.get(index)
            if item is None:
                raise DatasourceUnavailable(f"批量调用缺少第 {index} 条结果")
            if "error" in item:
                raise DatasourceUnavailable(str(item["error"]))
            results.append(item["result"])
        return results

    async def block_number(self) -> int:
        return int(await self._call("eth_blockNumber", []), 16)

    async def block_timestamp(self) -> int:
        block = await self._call("eth_getBlockByNumber", ["latest", False])
        return int(block["timestamp"], 16)

    async def native_balance(self, address: str) -> Decimal:
        raw = await self._call("eth_getBalance", [address, "latest"])
        return from_raw(int(raw, 16))

    async def convert_to_assets(self, vault: str, shares: int) -> int:
        """ERC-4626: 份额、对应资产数量（原始整数）"""

        raw = await self._call(
            "eth_call",
            [{"to": vault, "data": _convert_to_assets_data(shares)}, "latest"],
        )
        return int(_data(raw, vault), 16)

    async def erc20_balance(self, token: str, owner: str) -> int:
        """返回链上原始整数，不做小数转换"""

        raw = await self._call(
            "eth_call",
            [{"to": token, "data": _balance_of_data(owner)}, "latest"],
        )
        return int(_data(raw, token), 16)

    async def withdrawal_cooldown(self, vault: str) -> int:
        """解锁冷却期（秒）。链上是常量，仍然每次从链上取，不写死。"""

        raw = await self._call(
            "eth_call", [{"to": vault, "data": "0xfeedab00"}, "latest"]
        )
        return int(_data(raw, vault), 16)

    async def withdrawal_request_ids(self, vault: str, owner: str) -> list[int]:
        """该地址所有未领取的解锁请求 ID。"""

        raw = await self._call(
            "eth_call",
            [{"to": vault, "data": _request_ids_data(owner)}, "latest"],
        )
        return _decode_ids(_data(raw, vault))

    async def withdrawal_request(self, vault: str, request_id: int) -> dict:
        """单个解锁请求：assets / shares / requestTime / owner / receiver。"""

        raw = await self._call(
            "eth_call",
            [{"to": vault, "data": _request_data(request_id)}, "latest"],
        )
        return _decode_request(_data(raw, vault))

    async def staking_snapshot(self, vault: str, owner: str) -> dict:
        """质押相关的全部只读调用，两轮 batch 取回，返回链上原始整数。"""

        block_number, block, shares_raw, cooldown_raw, ids_raw = await self._batch([
            ("eth_blockNumber", []),
            ("eth_getBlockByNumber", ["latest", False]),
            ("eth_call", [{"to": vault, "data": _balance_of_data(owner)}, "latest"]),
            ("eth_call", [{"to": vault, "data": "0xfeedab00"}, "latest"]),
            ("eth_call", [{"to": vault, "data": _request_ids_data(owner)}, "latest"]),
        ])

        shares = int(_data(shares_raw, vault), 16)
        request_ids = _decode_ids(_data(ids_raw, vault))

        # 第二轮：份额换算与每个解锁请求，都只依赖上一轮的结果
        calls = [
            ("eth_call", [{"to": vault, "data": _request_data(rid)}, "latest"])
            for rid in request_ids
        ]
        if shares:
            calls.insert(
                0,
                ("eth_call",
                 [{"to": vault, "data": _convert_to_assets_data(shares)}, "latest"]),
            )

        results = await self._batch(calls) if calls else []
        assets = 0
        if shares:
            assets = int(_data(results.pop(0), vault), 16)

        return {
            "block_number": int(block_number, 16),
            "block_time": int(block["timestamp"], 16),
            "shares": shares,
            "assets": assets,
            "cooldown": int(_data(cooldown_raw, vault), 16),
            "requests": [
                {"request_id": rid, **_decode_request(_data(raw, vault))}
                for rid, raw in zip(request_ids, results)
            ],
        }
