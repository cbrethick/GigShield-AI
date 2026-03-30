from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import uuid
import enum

def gen_uuid():
    return str(uuid.uuid4())

class PolicyStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"

class ClaimStatus(str, enum.Enum):
    PENDING = "PENDING"
    FRAUD_CHECK = "FRAUD_CHECK"
    APPROVED = "APPROVED"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    PAID = "PAID"
    REJECTED = "REJECTED"

class TriggerType(str, enum.Enum):
    HEAVY_RAIN = "HEAVY_RAIN"
    FLOOD = "FLOOD"
    SEVERE_AQI = "SEVERE_AQI"
    PLATFORM_PAUSE = "PLATFORM_PAUSE"
    CURFEW = "CURFEW"

class Rider(Base):
    __tablename__ = "riders"

    id = Column(String, primary_key=True, default=gen_uuid)
    phone = Column(String(15), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=True)
    platform = Column(String(20), nullable=False)  # ZOMATO / SWIGGY
    zone = Column(String(100), nullable=False)
    pincode = Column(String(10), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    avg_daily_hours = Column(Float, default=8.0)
    avg_daily_earnings = Column(Float, default=800.0)
    work_start_hour = Column(Integer, default=9)
    work_end_hour = Column(Integer, default=21)
    upi_id = Column(String(100), nullable=True)
    device_fingerprint = Column(String(200), nullable=True)
    last_gps_lat = Column(Float, nullable=True)
    last_gps_lng = Column(Float, nullable=True)
    last_gps_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    policies = relationship("Policy", back_populates="rider")
    claims = relationship("Claim", back_populates="rider")

class Policy(Base):
    __tablename__ = "policies"

    id = Column(String, primary_key=True, default=gen_uuid)
    rider_id = Column(String, ForeignKey("riders.id"), nullable=False, index=True)
    policy_number = Column(String(20), unique=True, nullable=False)
    zone = Column(String(100), nullable=False)
    weekly_premium_inr = Column(Float, nullable=False)
    max_payout_inr = Column(Float, nullable=False)
    coverage_hours_per_event = Column(Float, default=8.0)
    risk_score = Column(Float, default=50.0)
    status = Column(String, default=PolicyStatus.ACTIVE)
    valid_from = Column(DateTime, nullable=False)
    valid_till = Column(DateTime, nullable=False)
    triggers = Column(Text, nullable=True)  # JSON list of trigger types covered
    created_at = Column(DateTime, server_default=func.now())

    rider = relationship("Rider", back_populates="policies")
    claims = relationship("Claim", back_populates="policy")

class Claim(Base):
    __tablename__ = "claims"

    id = Column(String, primary_key=True, default=gen_uuid)
    claim_number = Column(String(30), unique=True, nullable=False)
    rider_id = Column(String, ForeignKey("riders.id"), nullable=False, index=True)
    policy_id = Column(String, ForeignKey("policies.id"), nullable=False, index=True)
    trigger_type = Column(String, nullable=False)
    trigger_event_id = Column(String(100), nullable=False, index=True)
    trigger_value = Column(Float, nullable=True)   # e.g. 78.2 mm
    trigger_threshold = Column(Float, nullable=True)  # e.g. 64.0 mm
    zone = Column(String(100), nullable=False)
    duration_hours = Column(Float, default=0.0)
    payout_amount_inr = Column(Float, default=0.0)
    status = Column(String, default=ClaimStatus.PENDING)
    fraud_score = Column(Float, nullable=True)
    fraud_flags = Column(Text, nullable=True)  # JSON list
    razorpay_payout_id = Column(String(100), nullable=True)
    razorpay_fund_account_id = Column(String(100), nullable=True)
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    rider = relationship("Rider", back_populates="claims")
    policy = relationship("Policy", back_populates="claims")

class TriggerEvent(Base):
    __tablename__ = "trigger_events"

    id = Column(String, primary_key=True, default=gen_uuid)
    zone = Column(String(100), nullable=False, index=True)
    trigger_type = Column(String, nullable=False)
    trigger_value = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False)
    platform_status = Column(String(20), nullable=True)
    raw_data = Column(Text, nullable=True)
    claims_created = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

class OTPStore(Base):
    __tablename__ = "otp_store"

    id = Column(String, primary_key=True, default=gen_uuid)
    phone = Column(String(15), nullable=False, index=True)
    otp = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
