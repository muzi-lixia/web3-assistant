"""共享 HTTP 客户端：进程内复用连接，绕开本机代理。"""
import httpx

_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        # 本机 HTTP_PROXY 会把链上请求也转给代理，每次多几百毫秒
        _client = httpx.AsyncClient(trust_env=False)
    assert _client is not None
    return _client


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
