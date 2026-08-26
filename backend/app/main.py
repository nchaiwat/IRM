"""
IRM — Incoming Raw Material System
FastAPI Application Entry Point
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.init_db import seed_data
from app.services.scheduler import start_scheduler, stop_scheduler
from app.routers import (
    auth_matrix_router,
    auth_router,
    calendar_router,
    groups_router,
    history_router,
    items_router,
    menus_router,
    operation_router,
    settings_router,
    supplier_portal_router,
    suppliers_router,
    users_router,
    logs_router,
    dashboard_router,
    sap_router,
    qms_integration_router,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for startup and shutdown events."""
    print(f"🚀 Starting {settings.APP_NAME} Backend (Env: {settings.APP_ENV})...")
    try:
        await seed_data()
    except Exception as e:
        print(f"⚠️ Warning: Auto-seed on startup failed or skipped: {e}")
    try:
        start_scheduler()
    except Exception as e:
        print(f"⚠️ Warning: Scheduler startup failed: {e}")
    yield
    try:
        stop_scheduler()
    except Exception as e:
        print(f"⚠️ Warning: Scheduler shutdown failed: {e}")
    print(f"🛑 Shutting down {settings.APP_NAME} Backend...")


app = FastAPI(
    title=settings.APP_NAME,
    description="Incoming Raw Material (IRM) Backend API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
origins = [
    settings.FRONTEND_URL,
    "https://irm.windowasia.com",
    "http://irm.windowasia.com",
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(groups_router)
app.include_router(menus_router)
app.include_router(auth_matrix_router)
app.include_router(settings_router)
app.include_router(operation_router)
app.include_router(calendar_router)
app.include_router(items_router)
app.include_router(suppliers_router)
app.include_router(history_router)
app.include_router(supplier_portal_router)
app.include_router(logs_router)
app.include_router(dashboard_router)
app.include_router(sap_router)
app.include_router(qms_integration_router)


@app.get("/", tags=["Health"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}
