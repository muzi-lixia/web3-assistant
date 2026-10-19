from fastapi import FastAPI

from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.tokens import router as tokens_router
from app.core.logging import setup_logging
from fastapi.middleware.cors import CORSMiddleware

setup_logging()
app = FastAPI(title="Web3 智能助手")

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(tokens_router)
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
