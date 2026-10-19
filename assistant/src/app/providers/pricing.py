"""价格源：DefiLlama 公开接口，无需 key。缺失报价不补零，返回 None。"""

from decimal import Decimal

import httpx

from app.core.errors import DatasourceTimeout, DatasourceUnavailable

_BASE_URL = "https://coins.llama.fi/prices/current/"


class PriceProvider:
    def __init__(self, timeout: float = 8.0) -> None:
        self._timeout = timeout

    async def prices(self, chain: str, addresses: list[str]) -> dict[str, Decimal]:
        """返回 {小写地址: 单价}。查不到的不出现在结果里，由上层标注不可用。"""
        keys = ",".join(f"{chain}:{address.lower()}" for address in addresses)
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(_BASE_URL + keys)
                response.raise_for_status()
                body = response.json()
        except httpx.TimeoutException as exc:
            raise DatasourceTimeout(str(exc)) from exc
        except httpx.HTTPError as exc:
            raise DatasourceUnavailable(str(exc)) from exc

        coins = body.get("coins", {})
        result: dict[str, Decimal] = {}
        for key, item in coins.items():
            address = key.split(":", 1)[1].lower()
            price = item.get("price")
            if price is None:
                continue
            result[address] = Decimal(str(price))
        return result
