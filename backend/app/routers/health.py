"""Health check router."""

import os
from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "StatBot Pro API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
        "model": os.getenv("OPENAI_MODEL", "gpt-4o"),
    }
