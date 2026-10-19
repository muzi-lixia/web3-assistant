from pathlib import Path

from fastapi import FastAPI

from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.tokens import router as tokens_router
from app.core import db
from app.core.logging import TraceMiddleware, setup_logging
from fastapi.middleware.cors import CORSMiddleware

from app.providers.http import close

# 锚定到 assistant/logs，不受启动时工作目录影响
setup_logging(log_dir=Path(__file__).resolve().parents[2] / "logs")

async def lifespan(app: FastAPI):
    await db.init()
    yield
    await close()
    await db.close()

app = FastAPI(title="Web3 智能助手", lifespan=lifespan)
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(tokens_router)
# 后添加的在外层，CORS 要能处理预检，所以排在 Trace 之后
app.add_middleware(TraceMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.get("/api/v1/health")
async def health() -> dict:
    return {"status": "ok"}
