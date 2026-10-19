"""意图判定的结果对象：规则段与模型段共用。"""
from pydantic import BaseModel


class Intent(BaseModel):
    capability: str
    reason: str
    supported: bool = True
