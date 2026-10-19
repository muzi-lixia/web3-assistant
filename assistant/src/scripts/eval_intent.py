"""意图评测：规则段与模型段各自答对多少。"""
import asyncio

from app.intent.classifier import classify
from app.intent.rules import match

CASES: list[tuple[str, str | None]] = [
    # 规则段应当直接命中
    ("我的资产有多少", "asset_balance"),
    ("我钱包里有多少钱", "asset_balance"),
    ("我的质押资产", "staking_position"),
    ("我质押了多少", "staking_position"),
    ("我最近的交易记录", "transaction_history"),
    ("查一下我的转账", "transaction_history"),

    # 规则段认不出，只能靠模型
    ("帮我瞅瞅钱包里还剩点啥", "asset_balance"),
    ("我手上都有些什么币", "asset_balance"),
    ("我现在有多少家底", "asset_balance"),
    ("我在里面存的那部分现在什么情况", "staking_position"),
    ("之前押进去的东西怎么样了", "staking_position"),
    ("最近有没有进出账", "transaction_history"),
    ("前两天那笔到账了没", "transaction_history"),

    # 与产品无关，应当判空
    ("今天天气怎么样", None),
    ("帮我写一首诗", None),
    ("Berachain 是什么", None),
    ("给我讲讲区块链原理", None),
]

async def main() -> None:
    rows = []
    for text, expected in CASES:
        intent = match(text)
        source = "rule"
        if intent is None:
            intent = await classify(text)
            source = "model"

        got = intent.capability if intent else None
        rows.append((text, expected, got, source, got == expected))

    total = len(rows)
    correct = sum(1 for r in rows if r[4])
    rule_correct = sum(1 for r in rows if r[4] and r[3] == "rule")
    model_correct = sum(1 for r in rows if r[4] and r[3] == "model")

    print(f"总计：{total}条，答对 {correct} 条，准确率 {correct / total:.0%}")
    print(f"  规则段答对 {rule_correct} 条")
    print(f"  模型段答对 {model_correct} 条")

    misses = [r for r in rows if not r[4]]
    if not misses:
        print("\n没有错例")
        return

    print("\n错例：")
    for text, expected, got, source, _ in misses:
        print(f"  {text:28} 期望 {expected} 实际 {got}（{source}）")

if __name__ == "__main__":
    asyncio.run(main())
