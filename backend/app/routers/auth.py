from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Union
from datetime import datetime, timedelta
from app.db.database import get_db
from app.models.models import Rider, OTPStore
from app.services.auth_service import (
    generate_otp, create_access_token, send_otp_sms, verify_firebase_token
)
from app.db.redis_client import get_redis

router = APIRouter()

class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: Optional[str] = None
    otp: Optional[str] = None
    firebase_token: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    rider_id: str
    is_new_rider: bool

@router.post("/send-otp")
def send_otp(req: SendOTPRequest, db: Session = Depends(get_db)):
    phone = req.phone.strip()
    if not (10 <= len(phone) <= 15):
        raise HTTPException(status_code=400, detail="Invalid phone number")

    otp = generate_otp()

    # Store OTP in Redis (expires in 5 min)
    redis = get_redis()
    redis.setex(f"otp:{phone}", 300, otp)

    # Also store in DB for audit
    otp_record = OTPStore(
        phone=phone,
        otp=otp,
        expires_at=datetime.utcnow() + timedelta(minutes=5),
    )
    db.add(otp_record)
    db.commit()

    send_otp_sms(phone, otp)

    return {"message": "OTP sent", "phone": phone, "demo_otp": otp}  # remove demo_otp in prod

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(request: VerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Verifies the Firebase ID Token and issues a GigShield JWT.
    """
    # 1. Verify with Firebase
    phone = verify_firebase_token(request.firebase_token)
    
    if not phone:
        print(f"[AUTH] Firebase token verification failed for token: {request.firebase_token[:10]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase identity verification failed"
        )
    
    # Normalize phone for DB lookup
    phone = phone.replace(" ", "")

    redis = get_redis()
    redis.delete(f"otp:{phone}")

    # Get or create rider
    rider = db.query(Rider).filter(Rider.phone == phone).first()
    is_new = rider is None

    if is_new:
        rider = Rider(phone=phone, platform="ZOMATO", zone="", avg_daily_hours=8.0, avg_daily_earnings=800.0)
        db.add(rider)
        db.commit()
        db.refresh(rider)

    token = create_access_token({"sub": rider.id, "phone": phone})

    return {
        "access_token": token,
        "token_type": "bearer",
        "rider_id": rider.id,
        "is_new_rider": is_new,
    }
