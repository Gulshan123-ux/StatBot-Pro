"""
StatBot Pro — Week 2 Backend
New features:
  1. Redis job queue (async long-running analyses via Celery)
  2. WebSocket progress streaming
  3. Session persistence (follow-up questions remember context)
  4. Multi-file joins
  5. PDF report export (ReportLab)
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from app.routers import analysis, health, sessions, jobs
from app.core.connection_manager import ConnectionManager
from app.core.session_store import SessionStore

load_dotenv()

# ── Singletons ────────────────────────────────────────────────────
connection_manager = ConnectionManager()
session_store = SessionStore()


@asynccontextmanager
async def lifespan(app: FastAPI):
    charts_dir = os.getenv("CHARTS_DIR", "static/charts")
    reports_dir = os.getenv("REPORTS_DIR", "static/reports")
    os.makedirs(charts_dir, exist_ok=True)
    os.makedirs(reports_dir, exist_ok=True)
    print("✅ StatBot Pro v2 started.")
    yield
    print("👋 StatBot Pro v2 shutting down.")


app = FastAPI(
    title="StatBot Pro API v2",
    description="Autonomous CSV Data Analyst — Week 2 Edition",
    version="2.0.0",
    lifespan=lifespan,
)

# Store singletons on app state so routers can access them
app.state.ws_manager = connection_manager
app.state.session_store = session_store

# CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
for d in ["static/charts", "static/reports"]:
    os.makedirs(d, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Routers
app.include_router(health.router,    prefix="/api",          tags=["Health"])
app.include_router(analysis.router,  prefix="/api/analysis", tags=["Analysis"])
app.include_router(sessions.router,  prefix="/api/sessions", tags=["Sessions"])
app.include_router(jobs.router,      prefix="/api/jobs",     tags=["Jobs"])


# ── WebSocket endpoint ────────────────────────────────────────────
@app.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await connection_manager.connect(job_id, websocket)
    try:
        while True:
            await websocket.receive_text()   # keep alive / client pings
    except WebSocketDisconnect:
        connection_manager.disconnect(job_id)


@app.get("/")
async def root():
    return {
        "name": "StatBot Pro",
        "version": "2.0.0",
        "week2_features": [
            "Redis job queue",
            "WebSocket progress streaming",
            "Session persistence",
            "Multi-file joins",
            "PDF export",
        ],
    }
