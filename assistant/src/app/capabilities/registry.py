"""能力注册表：能力定义的唯一来源"""
from app.capabilities.balance import asset_balance
from app.capabilities.staking import staking_position
from app.capabilities.transactions import transaction_history

tools = [asset_balance, staking_position, transaction_history]
