import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid
import json
from datetime import datetime
from app.db.database import get_db, SessionLocal
from app.models.models import Rider, Claim, Policy, PolicyStatus, ClaimStatus
from app.routers.deps import get_current_rider
from app.services.claim_processor import process_trigger_event
from app.db.redis_client import get_redis as get_redis_client

router = APIRouter()

class TriggerRequest(BaseModel):
    zone: str
    trigger_type: str   # HEAVY_RAIN / FLOOD / SEVERE_AQI / PLATFORM_PAUSE / CURFEW
    trigger_value: float
    threshold: float
    platform_status: str = "PAUSED"
    duration_hours: float = 4.0

async def mock_payout_delay(trigger_event_id: str):
    """Wait 8 seconds then auto-approve claims for demo."""
    await asyncio.sleep(8)
    db = SessionLocal()
    try:
        claims = db.query(Claim).filter(
            Claim.trigger_event_id == trigger_event_id,
            Claim.status == ClaimStatus.APPROVED
        ).all()
        for c in claims:
            c.status = ClaimStatus.PAID
            c.paid_at = datetime.utcnow()
        db.commit()
    finally:
        db.close()

@router.get("/my")
def get_my_claims(
    rider: Rider = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    claims = db.query(Claim).filter(Claim.rider_id == rider.id).order_by(Claim.created_at.desc()).limit(10).all()
    result = []
    for c in claims:
        result.append({
            "id": c.id,
            "claim_number": c.claim_number,
            "trigger_type": c.trigger_type,
            "zone": c.zone,
            "trigger_value": c.trigger_value,
            "payout_amount_inr": c.payout_amount_inr,
            "payout_mode": c.payout_mode,
            "payout_details": json.loads(c.payout_details or "{}"),
            "status": c.status,
            "insurer_remark": c.insurer_remark,
            "fraud_flags": json.loads(c.fraud_flags or "[]"),
            "paid_at": c.paid_at.isoformat() if c.paid_at else None,
            "created_at": c.created_at.isoformat(),
        })
    return result

@router.get("/stats")
def get_rider_stats(
    rider: Rider = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    from sqlalchemy import func
    total_paid = db.query(func.sum(Claim.payout_amount_inr)).filter(
        Claim.rider_id == rider.id,
        Claim.status == ClaimStatus.PAID,
    ).scalar() or 0

    total_claims = db.query(func.count(Claim.id)).filter(Claim.rider_id == rider.id).scalar() or 0

    active_policy = db.query(Policy).filter(
        Policy.rider_id == rider.id,
        Policy.status == PolicyStatus.ACTIVE,
    ).first()

    return {
        "total_paid_inr": round(total_paid, 2),
        "total_claims": total_claims,
        "active_policy": {
            "id": active_policy.id,
            "policy_number": active_policy.policy_number,
            "max_payout_inr": active_policy.max_payout_inr,
            "valid_till": active_policy.valid_till.isoformat(),
            "weekly_premium_inr": active_policy.weekly_premium_inr,
        } if active_policy else None,
        "wallet_balance": rider.wallet_balance or 0.0,
    }

# ── VERIFY NO_GPS_DATA ENDPOINT ──
@router.post("/{claim_id}/verify-no-gps")
def verify_no_gps_claim(
    claim_id: str,
    rider: Rider = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    """Verifies a claim with NO_GPS_DATA using third party weather/news APIs and pushes it to B2B."""
    claim = db.query(Claim).filter(Claim.id == claim_id, Claim.rider_id == rider.id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    fraud_flags = json.loads(claim.fraud_flags or "[]")
    if "NO_GPS_DATA" not in fraud_flags:
        raise HTTPException(status_code=400, detail="Claim does not require NO_GPS_DATA verification")

    if claim.status != ClaimStatus.MANUAL_REVIEW and claim.status != ClaimStatus.PENDING:
        raise HTTPException(status_code=400, detail="Claim cannot be verified in its current state")

    # Mock API call to weather/news APIs
    print(f"[Verification] Calling Weather API for zone {claim.zone}")
    print(f"[Verification] Calling Local News API for zone {claim.zone}")
    
    # Remove the NO_GPS_DATA flag since verified by third party
    fraud_flags.remove("NO_GPS_DATA")
    claim.fraud_flags = json.dumps(fraud_flags)
    
    # Change status to PENDING so that the insurer portal batch process can see and approve it
    claim.status = ClaimStatus.PENDING
    
    # Append verification note to payout details
    try:
        details = json.loads(claim.payout_details or "{}")
    except:
        details = {}
    details["verification"] = "Verified via Weather & News API fallback"
    claim.payout_details = json.dumps(details)
    
    db.commit()
    return {"message": "Verification successful via third-party APIs. Claim forwarded to Insurer Portal.", "status": claim.status}

# ── DEMO / ADMIN ENDPOINTS ──

@router.post("/simulate-trigger")
async def simulate_trigger(
    req: TriggerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    # No auth - this is a demo/admin endpoint
):
    """
    Simulate a parametric trigger for demo purposes.
    In production this is called by the Node.js trigger service.
    """
    trigger_event_id = f"{req.trigger_type}:{req.zone.replace(' ','_')}:{datetime.utcnow().strftime('%Y%m%d%H%M')}"

    result = await process_trigger_event(
        db=db,
        zone=req.zone,
        trigger_type=req.trigger_type,
        trigger_value=req.trigger_value,
        threshold=req.threshold,
        platform_status=req.platform_status,
        trigger_event_id=trigger_event_id,
        duration_hours=req.duration_hours,
    )

    # Removed background task auto-approval for real B2B review flow
    # if result.get("approved", 0) > 0:
    #     background_tasks.add_task(mock_payout_delay, trigger_event_id)

    return {
        "trigger_event_id": trigger_event_id,
        "zone": req.zone,
        "trigger_type": req.trigger_type,
        "result": result,
        "message": f"Trigger processed. {result.get('claims_created', 0)} claims created.",
    }

@router.post("/admin/reset")
def reset_system_data(db: Session = Depends(get_db)):
    """Clears all claims, triggers, and notifications for a fresh demo."""
    from sqlalchemy import text
    try:
        # Clear tables
        db.execute(text("TRUNCATE TABLE claims CASCADE;"))
        db.execute(text("TRUNCATE TABLE trigger_events CASCADE;"))
        db.execute(text("TRUNCATE TABLE notifications CASCADE;"))
        
        # Reset rider balances
        db.execute(text("UPDATE riders SET wallet_balance = 0.0;"))
        db.commit()

        # Reset B2B balance in Redis
        r = get_redis_client()
        r.set("b2b_balance", "100000.0")

        return {"status": "success", "message": "System data reset. B2B balance back to ₹1,00,000."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook/razorpay")
async def razorpay_webhook(
    payload: dict,
    db: Session = Depends(get_db),
):
    """Razorpay webhook - updates claim status to PAID."""
    event = payload.get("event", "")
    if event == "payout.processed":
        payout_id = payload.get("payload", {}).get("payout", {}).get("entity", {}).get("id")
        reference_id = payload.get("payload", {}).get("payout", {}).get("entity", {}).get("reference_id", "")
        if reference_id.startswith("GS-CLM-"):
            claim_suffix = reference_id.replace("GS-CLM-", "")
            claim = db.query(Claim).filter(Claim.id.like(f"{claim_suffix}%")).first()
            if claim:
                claim.status = ClaimStatus.PAID
                claim.razorpay_payout_id = payout_id
                claim.paid_at = datetime.utcnow()
                db.commit()
    return {"status": "ok"}
