from dataclasses import dataclass


@dataclass(frozen=True)
class Token:
    symbol: str
    address: str
    decimals: int

WBERA = Token("WBERA", "0x6969696969696969696969696969696969696969", 18)
SWBERA = Token("sWBERA", "0x118d2ceee9785eaf70c15cd74cd84c9f8c3eec9a", 18)

VERIFIED_TOKENS: tuple[Token, ...] = (WBERA, SWBERA)

