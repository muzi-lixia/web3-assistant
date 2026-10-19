"""能力结果：强制携带溯源源，从类型层面拒绝无源答案"""
from pydantic import BaseModel, Field, model_validator

from app.domain.provenance import Provenance


class CapabilityResult(BaseModel):
    capability: str
    arguments: dict = Field(default_factory=dict)
    data: dict
    provenance: list[Provenance]

    @model_validator(mode="after")
    def _require_provenance(self) -> "CapabilityResult":
        if not self.provenance:
            raise ValueError("结果缺少溯源信息，禁止输出无源答案")
        return self
