"""错误分类：对外暴露稳定 code,不把内部异常文本泄露给用户"""


class AppError(Exception):
    """业务上可预期的错误。code 给前端分支，message直接给用户看"""

    code: str = "internal_error"
    message: str = "服务暂时不可用，请稍后重试"
    retryable: bool = False

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail
        super().__init__(detail or self.message)

class DatasourceUnavailable(AppError):
    code = "datasource_unavailable"
    message = "链上数据源暂时不可用，请稍后重试。"
    retryable = True

class DatasourceTimeout(DatasourceUnavailable):
    code = "datasource_timeout"
    message = "链上数据源响应超时，请稍后重试。"

class RateLimited(AppError):
    code = "rate_limited"
    message = "查询过于频繁，请稍后重试"
    retryable = True

class AddressRejected(AppError):
    code = "address_rejected"
    message = "我只能查询你当前登录钱包的地址，无法查询其他地址。"
    retryable = False

class IntentUnrecognized(AppError):
    code = "intent_unrecognized"
    message = "我可以帮你查询资产余额、质押情况、交易记录。你可以换个问法试试。"
    retryable = False

class FeatureUnavailable(AppError):
    """意图认得出来，但对应能力还没接入数据源"""

    code = "feature_unavailable"
    message = "这个功能还在接入数据源，暂时无法提供。"
    retryable = False

class ConversationForbidden(AppError):
    code = "conversation_forbidden"
    message = "无法访问该会话，请新建一个对话。"
    retryable = False

