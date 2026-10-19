"""能力结果：强制携带朔源，从类型层面拒绝无源答案"""
from pydantic import BaseModel, model_validator

from app.domain.provenance import Provenance


class CapabilityResult(BaseModel):
    capability: str
    answer: dict
    provenance: list[Provenance]

    @model_validator(mode="after")
    def _require_provenance(self) -> "CapabilityResult":
        if not self.provenance:
            raise ValueError("结果缺少朔源信息，禁止输出无源答案")
        return self
