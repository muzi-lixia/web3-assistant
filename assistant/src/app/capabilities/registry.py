"""能力注册表：能力定义的唯一来源"""
from app.capabilities.balance import BalanceCapability
from app.capabilities.base import Capability
from app.capabilities.staking import StakingCapability


class CapabilityRegistry:
    def __init__(self) -> None:
        self._items: dict[str, Capability] = {}

    def registry(self, capability: Capability) -> None:
        if capability.name in self._items:
            raise ValueError(f"能力名重复: {capability.name}")
        self._items[capability.name] = capability

    def get(self, name: str) -> Capability:
        if name not in self._items:
            raise KeyError(f"未注册的能力：{name}")
        return self._items[name]

    def all(self) -> list[Capability]:
        return list(self._items.values())

    def names(self) -> list[str]:
        return list(self._items)


registry = CapabilityRegistry()
registry.registry(BalanceCapability())
registry.registry(StakingCapability())
