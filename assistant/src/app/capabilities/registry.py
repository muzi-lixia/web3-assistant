"""能力注册表：工具定义与参数约束的唯一出口。"""

from app.capabilities.balance import asset_balance
from app.capabilities.staking import staking_position
from app.capabilities.transactions import transaction_history

tools = [asset_balance, staking_position, transaction_history]
