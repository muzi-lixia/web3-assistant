"""Etherscan V2 兼容接口：只读查交易列表。"""
import httpx

from app.core.errors import DatasourceTimeout, DatasourceUnavailable, RateLimited

_BASE_URL = "https://api.etherscan.io/v2/api"


class ExplorerProvider:
    def __init__(self, api_key: str, chain_id: int, timeout: float = 10.0) -> None:
        self._api_key = api_key
        self._chain_id = chain_id
        self._timeout = timeout

    async def _get(self, params: dict) -> list[dict]:
        query = {"chainid": self._chain_id, "apikey": self._api_key, **params}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(_BASE_URL, params=query)
                response.raise_for_status()
                body = response.json()
        except httpx.TimeoutException as exc:
            raise DatasourceTimeout(str(exc)) from exc
        except httpx.HTTPError as exc:
            raise DatasourceUnavailable(str(exc)) from exc

        if body.get("status") == "0":
            message = str(body.get("message", ""))
            if message == "No transactions found":
                return []
            if "rate limit" in message.lower():
                raise RateLimited(message)
            raise DatasourceUnavailable(f"{message}: {body.get('result')}")

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
