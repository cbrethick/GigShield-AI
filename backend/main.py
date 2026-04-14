from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()

from app.db.database import engine, Base
from app.routers import auth, onboarding, policy, claims, verification, analytics, insurer

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    Base.metadata.create_all(bind=engine)
    print("[GigShield] Database tables created/verified")
    yield
    print("[GigShield] Shutting down")

app = FastAPI(
    title="GigShield API",
    description="AI-powered parametric income insurance for food delivery partners",
    version="1.0.0",
    lifespan=lifespan,
)

# Universal CORS Middleware (Forced Injection)
@app.middleware("http")
async def add_cors_header(request, call_next):
    if request.method == "OPTIONS":
        from fastapi.responses import Response
        response = Response()
    else:
        response = await call_next(request)
    
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "false"
    return response

app.include_router(auth.router,        prefix="/auth",      tags=["Auth"])
app.include_router(onboarding.router,  prefix="/riders",    tags=["Riders"])
app.include_router(policy.router,      prefix="/policy",    tags=["Policy"])
app.include_router(claims.router,      prefix="/api/claims", tags=["Claims"])
app.include_router(verification.router, prefix="/api/verify", tags=["Verification"])
app.include_router(analytics.router,   prefix="/api/analytics", tags=["Analytics"])
app.include_router(insurer.router,     prefix="/api/v1", tags=["Insurer"])

@app.get("/")
def root():
    return {
        "service": "GigShield API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }

@app.get("/health")
def health():
    return {"status": "ok"}
