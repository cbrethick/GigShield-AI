from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional, List
import uuid
import json
from app.db.database import get_db
from app.models.models import Rider, Policy, PolicyStatus
from app.routers.deps import get_current_rider
from app.services.premium_calculator import calculate_weekly_premium

router = APIRouter()

def gen_policy_number() -> str:
    return f"GS-{datetime.utcnow().strftime('%Y%m')}-{str(uuid.uuid4())[:6].upper()}"

class PolicyCreate(BaseModel):
    zone: Optional[str] = None  # uses rider zone if not provided

class PolicyResponse(BaseModel):
    id: str
    policy_number: str
    zone: str
    weekly_premium_inr: float
    max_payout_inr: float
    risk_score: float
    status: str
    valid_from: str
    valid_till: str

@router.get("/quote")
def get_quote(
    rider: Rider = Depends(get_current_rider),
):
    if not rider.zone:
        raise HTTPException(status_code=400, detail="Complete your profile first")
    quote = calculate_weekly_premium(
        zone=rider.zone,
        avg_daily_hours=rider.avg_daily_hours,
        avg_daily_earnings=rider.avg_daily_earnings,
    )
    return quote

@router.post("/create")
def create_policy(
    data: PolicyCreate,
    rider: Rider = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    zone = data.zone or rider.zone
    if not zone:
        raise HTTPException(status_code=400, detail="Zone is required")

    # Check for existing active policy
    existing = db.query(Policy).filter(
        Policy.rider_id == rider.id,
        Policy.status == PolicyStatus.ACTIVE,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Active policy already exists")

    quote = calculate_weekly_premium(
        zone=zone,
        avg_daily_hours=rider.avg_daily_hours,
        avg_daily_earnings=rider.avg_daily_earnings,
    )

    now = datetime.utcnow()
    # Policy runs Sunday to Sunday
    days_to_sunday = (6 - now.weekday()) % 7 or 7
    valid_from = now
    valid_till = now + timedelta(days=days_to_sunday)

    policy = Policy(
        rider_id=rider.id,
        policy_number=gen_policy_number(),
        zone=zone,
        weekly_premium_inr=quote["weekly_premium_inr"],
        max_payout_inr=quote["max_payout_inr"],
        coverage_hours_per_event=quote["coverage_hours_per_event"],
        risk_score=quote["risk_score"],
        status=PolicyStatus.ACTIVE,
        valid_from=valid_from,
        valid_till=valid_till,
        triggers=json.dumps(["HEAVY_RAIN", "FLOOD", "SEVERE_AQI", "PLATFORM_PAUSE", "CURFEW"]),
    )
    db.add(policy)

    # Add rider to Redis zone watch list
    from app.db.redis_client import get_redis
    redis = get_redis()
    redis.sadd(f"active_zone:{zone.split()[0].lower()}", rider.id)
    redis.setex(f"policy_active:{rider.id}", 86400 * 7, policy.id if policy.id else "pending")

    db.commit()
    db.refresh(policy)

    return {
        "policy": {
            "id": policy.id,
            "policy_number": policy.policy_number,
            "zone": policy.zone,
            "weekly_premium_inr": policy.weekly_premium_inr,
            "max_payout_inr": policy.max_payout_inr,
            "risk_score": policy.risk_score,
            "status": policy.status,
            "valid_from": policy.valid_from.isoformat(),
            "valid_till": policy.valid_till.isoformat(),
        },
        "premium_quote": quote,
        "message": "Policy activated successfully",
    }

@router.patch("/active/zone")
def update_policy_zone(
    data: PolicyCreate,
    rider: Rider = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    """Allow rider to switch their active policy's zone."""
    if not data.zone:
        raise HTTPException(status_code=400, detail="New zone required")

    policy = db.query(Policy).filter(
        Policy.rider_id == rider.id,
        Policy.status == PolicyStatus.ACTIVE,
    ).first()

    if not policy:
        raise HTTPException(status_code=404, detail="No active policy found to update")

    # 1. Recalculate based on new zone
    quote = calculate_weekly_premium(
        zone=data.zone,
        avg_daily_hours=rider.avg_daily_hours,
        avg_daily_earnings=rider.avg_daily_earnings,
    )

    # 2. Update policy
    old_zone = policy.zone
    policy.zone = data.zone
    policy.weekly_premium_inr = quote["weekly_premium_inr"]
    policy.max_payout_inr = quote["max_payout_inr"]
    policy.risk_score = quote["risk_score"]

    # 3. Update Redis watch list
    from app.db.redis_client import get_redis
    redis = get_redis()
    redis.srem(f"active_zone:{old_zone.split()[0].lower()}", rider.id)
    redis.sadd(f"active_zone:{data.zone.split()[0].lower()}", rider.id)

    db.commit()
    return {
        "message": f"Policy zone updated from {old_zone} to {data.zone}",
        "new_premium": policy.weekly_premium_inr,
        "new_max_payout": policy.max_payout_inr
    }

@router.get("/my")
def get_my_policies(
    rider: Rider = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    policies = db.query(Policy).filter(Policy.rider_id == rider.id).order_by(Policy.created_at.desc()).limit(5).all()
    return [
        {
            "id": p.id,
            "policy_number": p.policy_number,
            "zone": p.zone,
            "weekly_premium_inr": p.weekly_premium_inr,
            "max_payout_inr": p.max_payout_inr,
            "risk_score": p.risk_score,
            "status": p.status,
            "valid_from": p.valid_from.isoformat(),
            "valid_till": p.valid_till.isoformat(),
        }
        for p in policies
    ]

@router.get("/zones")
def get_available_zones():
    """Return all supported zones with risk data."""
    from app.services.premium_calculator import ZONE_RISK_DATA
    zones = []
    for zone, data in ZONE_RISK_DATA.items():
        zones.append({
            "zone": zone,
            "flood_score": data["flood_score"],
            "avg_aqi": data["avg_aqi"],
            "disruption_90d": data["disruption_90d"],
            "risk_level": "HIGH" if data["flood_score"] > 0.6 else "MEDIUM" if data["flood_score"] > 0.35 else "LOW",
        })
    return zones
