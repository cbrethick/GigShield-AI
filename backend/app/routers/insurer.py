from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import TriggerEvent, Claim, ClaimStatus
from sqlalchemy import func
from app.services.insurer_service import (
    approve_batch, get_insurer_analytics, reject_batch,
    get_notifications, mark_notification_read
)
from app.db.redis_client import get_redis

router = APIRouter(prefix="/insurer", tags=["Insurer"])

@router.get("/live-alerts")
def get_live_alerts(db: Session = Depends(get_db)):
    """Returns recent trigger events enriched with status and fraud data."""
    events = db.query(TriggerEvent).order_by(TriggerEvent.created_at.desc()).limit(20).all()
    result = []
    for ev in events:
        claims = db.query(Claim).filter(Claim.trigger_event_id == ev.id).all()
        statuses = [c.status for c in claims]
        
        # Determine consolidated batch status
        if not claims:
            batch_status = "RESOLVED"
            displayed_payout = 0
        elif any(s in [ClaimStatus.PENDING, ClaimStatus.MANUAL_REVIEW, ClaimStatus.FRAUD_CHECK] for s in statuses):
            batch_status = "PENDING"
            displayed_payout = ev.claims_created * 400
        elif all(s == ClaimStatus.REJECTED for s in statuses):
            batch_status = "REJECTED"
            displayed_payout = 0
        elif any(s == ClaimStatus.REJECTED for s in statuses) and any(s in [ClaimStatus.PAID, ClaimStatus.APPROVED] for s in statuses):
            batch_status = "PARTIAL"
            accepted_payout = db.query(func.sum(Claim.payout_amount_inr)).filter(Claim.trigger_event_id == ev.id, Claim.status.in_([ClaimStatus.APPROVED, ClaimStatus.PAID])).scalar() or 0
            displayed_payout = accepted_payout
        else:
            batch_status = "APPROVED"
            accepted_payout = db.query(func.sum(Claim.payout_amount_inr)).filter(Claim.trigger_event_id == ev.id, Claim.status.in_([ClaimStatus.APPROVED, ClaimStatus.PAID])).scalar() or 0
            displayed_payout = accepted_payout

        # Avg fraud score
        fraud_scores = [c.fraud_score for c in claims if c.fraud_score is not None]
        avg_fraud = round(sum(fraud_scores) / len(fraud_scores), 3) if fraud_scores else 0.12
        result.append({
            "id": ev.id,
            "zone": ev.zone,
            "trigger_type": ev.trigger_type,
            "trigger_value": ev.trigger_value,
            "threshold": ev.threshold,
            "claims_created": ev.claims_created,
            "total_payout_inr": displayed_payout,
            "created_at": ev.created_at,
            "status": batch_status,
            "avg_fraud_score": avg_fraud,
            "imd_verified": True, 
        })
    return result

@router.get("/batch-details/{event_id}")
def get_batch_details(event_id: str, db: Session = Depends(get_db)):
    """Returns all claims with enriched signal data for the batch modal."""
    claims = db.query(Claim).filter(Claim.trigger_event_id == event_id).all()
    result = []
    for c in claims:
        fs = c.fraud_score or 0.1
        result.append({
            "id": c.id,
            "rider_id": c.rider_id,
            "zone": c.zone,
            "payout_amount_inr": c.payout_amount_inr,
            "fraud_score": fs,
            "status": c.status,
            # Derived signal fields from fraud score (for BatchModal display)
            "mobility_match": round(1.0 - fs, 2),
            "cell_tower_match": fs < 0.5,
            "accelerometer_ok": fs < 0.7,
            "live_lat": getattr(c.rider, "last_gps_lat", None),
            "live_lng": getattr(c.rider, "last_gps_lng", None),
            "name": getattr(c.rider, "name", "Verified Rider"),
            "upi_id": getattr(c.rider, "upi_id", None),
        })
    return result

@router.post("/approve-batch/{event_id}")
async def post_approve_batch(event_id: str, db: Session = Depends(get_db)):
    """Approves a batch of claims."""
    result = await approve_batch(db, event_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

class RejectRequest(BaseModel):
    remark: str = None

@router.post("/reject-batch/{event_id}")
async def post_reject_batch(event_id: str, req: RejectRequest, db: Session = Depends(get_db)):
    """Rejects a batch of claims."""
    result = await reject_batch(db, event_id, remark=req.remark)
    return result

@router.get("/notifications")
def get_insurer_notifications(db: Session = Depends(get_db)):
    """Returns unread notifications for the insurer."""
    return get_notifications(db)

@router.post("/notifications/{id}/read")
def post_mark_read(id: str, db: Session = Depends(get_db)):
    """Marks a notification as read."""
    return mark_notification_read(db, id)

@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """Returns insurer-level analytics."""
    return get_insurer_analytics(db)

@router.get("/fraud-clusters")
def get_fraud_clusters(db: Session = Depends(get_db)):
    """Returns high-fraud zones for the heatmap based on real data."""
    # Query rejected claims grouped by zone
    results = db.query(
        Claim.zone,
        func.count(Claim.id).label("fraud_count")
    ).filter(
        Claim.status == ClaimStatus.REJECTED
    ).group_by(Claim.zone).all()
    
    zones = ["T. Nagar", "Anna Nagar", "Velachery", "Tambaram", "Adyar", "Porur"]
    cluster_data = {z: 0 for z in zones}
    
    for row in results:
        cluster_data[row.zone] = row.fraud_count
        
    response = []
    for zone, count in cluster_data.items():
        if count >= 10:
            risk = "Critical"
        elif count >= 5:
            risk = "High"
        elif count >= 2:
            risk = "Medium"
        elif count > 0:
            risk = "Low"
        else:
            risk = "Safe"
            
        response.append({
            "zone": zone,
            "fraud_count": count,
            "risk": risk
        })
        
    return response

class BalanceRequest(BaseModel):
    amount: float

@router.get("/balance")
def get_b2b_balance():
    redis = get_redis()
    val = redis.get("b2b_balance")
    return {"balance": float(val) if val else 100000.0}

@router.post("/balance")
def update_b2b_balance(req: BalanceRequest):
    redis = get_redis()
    redis.set("b2b_balance", str(req.amount))
    return {"balance": req.amount}

@router.post("/reset")
def reset_system_data(db: Session = Depends(get_db)):
    """Clear all claims, trigger events, and notifications for a clean demo start."""
    try:
        from app.models.models import Notification
        db.query(Claim).delete()
        db.query(TriggerEvent).delete()
        db.query(Notification).delete()
        db.commit()
        
        # Reset balance in Redis
        r = get_redis()
        r.set("b2b_balance", "100000.0")
        
        return {"status": "success", "message": "All data cleared successfully. Balance reset to ₹1,00,000."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")
