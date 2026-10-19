"""本地登录自测：申请 nonce → 用测试私钥签名 → 验签。"""

import json
import urllib.request

from eth_account import Account
from eth_account.messages import encode_defunct

BASE = "http://127.0.0.1:8000"
PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


def post(path: str, body: dict) -> dict:
    request = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read())


account = Account.from_key(PRIVATE_KEY)
print("本地账户地址:", account.address)

nonce_response = post("/api/v1/auth/nonce", {"address": account.address})
message = nonce_response["message"]
print("拿到 nonce:", nonce_response["nonce"])

signed = Account.sign_message(encode_defunct(text=message), PRIVATE_KEY)
result = post(
    "/api/v1/auth/verify",
    {"message": message, "signature": signed.signature.to_0x_hex()},
)
print("验签通过:", result["display_address"])
print("令牌", result["token"][:40]+"...")

request1 = urllib.request.Request(
    BASE + "/api/v1/auth/me",
    headers={"Authorization": f"Bearer {result['token']}"},
    method="GET"
)
with urllib.request.urlopen(request1) as response:
    print("带令牌访问 /me:", json.loads(response.read()))
request = urllib.request.Request(
    BASE + "/api/v1/chat",
    data=json.dumps({"message": "我现在的资产有多少"}).encode(),
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer " + result["token"],
    },
    method="POST",
)
with urllib.request.urlopen(request) as response:
    for line in response:
        print(line.decode().rstrip())



with urllib.request.urlopen(
    urllib.request.Request(
        BASE + "/api/v1/tokens",
        headers={"Authorization": "Bearer " + result["token"]},
    )
) as response:
    print("范围:", json.loads(response.read()))

# logout = urllib.request.Request(
#     BASE + "/api/v1/auth/logout",
#     data=b"{}",
#     headers={
#         "Content-Type": "application/json",
#         "Authorization": "Bearer " + result["token"],
#     },
#     method="POST",
# )
# with urllib.request.urlopen(logout) as response:
#     print("登出:", json.loads(response.read()))
#
# try:
#     urllib.request.urlopen(
#         urllib.request.Request(
#             BASE + "/api/v1/auth/me",
#             headers={"Authorization": "Bearer " + result["token"]},
#         )
#     )
#     print("!!! 登出后令牌仍可用，红线破了")
# except urllib.error.HTTPError as exc:
#     print("登出后 /me:", exc.code, exc.read().decode())


put = urllib.request.Request(
    BASE + "/api/v1/tokens",
    data=json.dumps({"addresses": ["0x6969696969696969696969696969696969696969"]}).encode(),
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer " + result["token"],
    },
    method="PUT",
)
with urllib.request.urlopen(put) as response:
    print("PUT 之后:", json.loads(response.read()))
