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

# Security: Specify exact domains for CORS
ALLOWED_ORIGINS = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    os.getenv("INSURER_URL", "http://localhost:3002"),
    "https://gigshield.vercel.app",
    "https://gigshield-insurer-portal.vercel.app",
    "http://localhost:3000",
    "http://localhost:3002"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
