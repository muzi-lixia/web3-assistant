"""数据朔源：任何对外输出的数字都必须说明来源与统计时点"""
from datetime import datetime

from pydantic import BaseModel


class Provenance(BaseModel):
    """一条朔源记录：哪个字段、来自哪个源、取数时点"""

    field: str
    source: str
    at: datetime
