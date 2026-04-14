from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Union
from datetime import datetime, timedelta
from app.db.database import get_db
from app.models.models import Rider, OTPStore, gen_uuid
from app.services.auth_service import (
    generate_otp, create_access_token, send_otp_sms, verify_firebase_token, send_email_otp
)
from app.db.redis_client import get_redis

router = APIRouter()

class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
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
    
    # Demo bypass: if this is the demo number, always return the fixed OTP
    if phone in ("6383686510", "+916383686510"):
        redis.setex(f"otp:{phone}", 86400, "141020")  # 24h expiry, fixed OTP
        return {"message": "OTP sent", "phone": phone, "demo_otp": "141020"}
    
    return {"message": "OTP sent", "phone": phone, "demo_otp": otp}

class SendEmailOTPRequest(BaseModel):
    email: str

@router.post("/send-email-otp")
def send_email_otp_endpoint(req: SendEmailOTPRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    otp = generate_otp()

    # Store OTP in Redis (expires in 5 min)
    redis = get_redis()
    redis.setex(f"otp:{email}", 300, otp)

    # Also store in DB for audit
    otp_record = OTPStore(
        email=email,
        otp=otp,
        expires_at=datetime.utcnow() + timedelta(minutes=5),
    )
    db.add(otp_record)
    db.commit()

    send_email_otp(email, otp)

    return {"message": "OTP sent to email", "email": email, "demo_otp": otp}

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(request: VerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Verifies the OTP (SMS/Email) or Firebase ID Token and issues a GigShield JWT.
    """
    phone = None
    email = None

    # 1. Verify with Firebase (Phone or Google)
    if request.firebase_token:
        identity = verify_firebase_token(request.firebase_token)
        if not identity:
            raise HTTPException(status_code=401, detail="Firebase identity verification failed")
        phone = identity.get("phone")
        email = identity.get("email")
    
    # 2. Verify with direct Email OTP
    elif request.email and request.otp:
        email = request.email.strip().lower()
        redis = get_redis()
        stored_otp = redis.get(f"otp:{email}")
        if not stored_otp or stored_otp.decode() != request.otp:
            # Fallback to DB check
            otp_record = db.query(OTPStore).filter(
                OTPStore.email == email, 
                OTPStore.otp == request.otp,
                OTPStore.expires_at > datetime.utcnow(),
                OTPStore.used == False
            ).first()
            if not otp_record:
                raise HTTPException(status_code=401, detail="Invalid or expired email OTP")
            otp_record.used = True
            db.commit()
        redis.delete(f"otp:{email}")

    # 3. Verify with direct SMS OTP
    elif request.phone and request.otp:
        phone = request.phone.strip()
        
        # Demo bypass: fixed credentials always work
        if phone in ("6383686510", "+916383686510") and request.otp == "141020":
            pass  # Always allow demo login
        else:
            redis = get_redis()
            stored_otp = redis.get(f"otp:{phone}")
            if not stored_otp or stored_otp.decode() != request.otp:
                # Fallback to DB check (like email)
                otp_record = db.query(OTPStore).filter(
                    OTPStore.phone == phone,
                    OTPStore.otp == request.otp,
                    OTPStore.expires_at > datetime.utcnow(),
                    OTPStore.used == False
                ).first()
                if not otp_record:
                    raise HTTPException(status_code=401, detail="Invalid or expired SMS OTP")
                otp_record.used = True
                db.commit()
            else:
                redis.delete(f"otp:{phone}")

    if not phone and not email:
        raise HTTPException(status_code=400, detail="Missing verification credentials")

    # Get or create rider
    query = db.query(Rider)
    if phone:
        rider = query.filter(Rider.phone == phone).first()
    else:
        rider = query.filter(Rider.email == email).first()
    
    is_new = rider is None

    if is_new:
        rider = Rider(
            phone=phone if phone else f"EMAIL_{gen_uuid()[:8]}", # Dummy phone if only email
            email=email,
            platform="ZOMATO", 
            zone="", 
            avg_daily_hours=8.0, 
            avg_daily_earnings=800.0
        )
        db.add(rider)
        db.commit()
        db.refresh(rider)
    elif email and not rider.email:
        # Link email to existing phone-based account
        rider.email = email
        db.commit()
    elif phone and not rider.phone:
        # Link phone to existing email-based account
        rider.phone = phone
        db.commit()

    token = create_access_token({"sub": rider.id, "phone": rider.phone, "email": rider.email})

    return {
        "access_token": token,
        "token_type": "bearer",
        "rider_id": rider.id,
        "is_new_rider": is_new,
    }
