"""应用配置：全部从环境变量覆盖，代码不留真实凭据"""

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

    chain_id: int = 80094
    session_domain: str = "localhost"
    session_url: str = "http://localhost:8000"
    session_statement: str = "Sign in to Berachain Web3 Assistant"

    jwt_secret: str = "dev-only-please-change-me-32bytes-min"
    jwt_ttl_seconds: int = 3600

    rpc_url: str = "https://rpc.berachain.com"
    # rpc_url: str = "http://127.0.0.1:9"

    chat_rate_limit_per_minute: int = 20
    redis_url: str = "redis://localhost:6379/0"

    ollama_url: str = "http://127.0.0.1:11434"
    intent_model: str = "qwen2.5:7b"

    etherscan_api_key: str = ""


settings = Settings()
