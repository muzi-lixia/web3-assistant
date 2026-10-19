"""提示词：一个文件一个版本，渲染用 Jinja2，注释不进输出。"""
from functools import lru_cache
from pathlib import Path

from jinja2 import Template

_DIR = Path(__file__).parent


@lru_cache(maxsize=None)
def prompt(name: str) -> Template:
    """name 形如 agent_v1，读 prompts/agent_v1.j2。"""
    source = (_DIR / f"{name}.j2").read_text(encoding="utf-8")
    return Template(source)
