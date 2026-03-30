from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta
import json
from app.db.database import get_db
from app.models.models import Claim, Policy, Rider, TriggerEvent, ClaimStatus, PolicyStatus

router = APIRouter()

@router.get("/insurer")
def insurer_dashboard(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    week_start = now - timedelta(days=7)

    # Active policies
    active_policies = db.query(func.count(Policy.id)).filter(
        Policy.status == PolicyStatus.ACTIVE
    ).scalar() or 0

    # Claims this week
    claims_week = db.query(func.count(Claim.id)).filter(
        Claim.created_at >= week_start
    ).scalar() or 0

    # Total payout this week
    payout_week = db.query(func.sum(Claim.payout_amount_inr)).filter(
        Claim.status == ClaimStatus.PAID,
        Claim.created_at >= week_start,
    ).scalar() or 0

    # Total premiums collected (approx)
    total_premium = db.query(func.sum(Policy.weekly_premium_inr)).filter(
        Policy.status == PolicyStatus.ACTIVE
    ).scalar() or 1

    loss_ratio = round((payout_week / max(total_premium, 1)) * 100, 1)

    # Fraud blocked this week
    fraud_blocked = db.query(func.count(Claim.id)).filter(
        Claim.created_at >= week_start,
        Claim.status.in_(["REJECTED", "MANUAL_REVIEW"]),
    ).scalar() or 0

    fraud_saved = db.query(func.sum(Claim.payout_amount_inr)).filter(
        Claim.created_at >= week_start,
        Claim.status == "REJECTED",
    ).scalar() or 0

    # Claims by trigger type
    trigger_counts = db.query(
        Claim.trigger_type,
        func.count(Claim.id).label("count"),
        func.sum(Claim.payout_amount_inr).label("total")
    ).filter(Claim.created_at >= week_start).group_by(Claim.trigger_type).all()

    # Zone risk breakdown
    zone_claims = db.query(
        Claim.zone,
        func.count(Claim.id).label("claim_count"),
        func.sum(Claim.payout_amount_inr).label("total_payout"),
    ).filter(Claim.created_at >= week_start).group_by(Claim.zone).order_by(
        func.count(Claim.id).desc()
    ).limit(8).all()

    # Recent claims
    recent_claims = db.query(Claim).order_by(Claim.created_at.desc()).limit(10).all()

    # Weekly trend (last 6 weeks)
    weekly_trend = []
    for i in range(5, -1, -1):
        wk_start = now - timedelta(weeks=i+1)
        wk_end   = now - timedelta(weeks=i)
        cnt = db.query(func.count(Claim.id)).filter(
            Claim.created_at >= wk_start,
            Claim.created_at < wk_end,
        ).scalar() or 0
        payout = db.query(func.sum(Claim.payout_amount_inr)).filter(
            Claim.status == ClaimStatus.PAID,
            Claim.created_at >= wk_start,
            Claim.created_at < wk_end,
        ).scalar() or 0
        weekly_trend.append({
            "week": wk_start.strftime("W%W"),
            "claims": cnt,
            "payout_inr": round(payout, 2),
        })

    return {
        "summary": {
            "active_policies": active_policies,
            "claims_this_week": claims_week,
            "payout_this_week_inr": round(payout_week, 2),
            "loss_ratio_pct": loss_ratio,
            "fraud_blocked": fraud_blocked,
            "fraud_saved_inr": round(fraud_saved, 2),
        },
        "trigger_breakdown": [
            {"trigger": t.trigger_type, "count": t.count, "total_inr": round(t.total or 0, 2)}
            for t in trigger_counts
        ],
        "zone_risk": [
            {"zone": z.zone, "claims": z.claim_count, "payout_inr": round(z.total_payout or 0, 2)}
            for z in zone_claims
        ],
        "recent_claims": [
            {
                "id": c.id,
                "claim_number": c.claim_number,
                "zone": c.zone,
                "trigger": c.trigger_type,
                "amount_inr": c.payout_amount_inr,
                "status": c.status,
                "fraud_flags": json.loads(c.fraud_flags or "[]"),
                "created_at": c.created_at.isoformat(),
            }
            for c in recent_claims
        ],
        "weekly_trend": weekly_trend,
    }

@router.get("/live")
def live_stats(db: Session = Depends(get_db)):
    """Lightweight endpoint for real-time dashboard polling."""
    now = datetime.utcnow()
    last_hour = now - timedelta(hours=1)

    pending = db.query(func.count(Claim.id)).filter(
        Claim.status.in_(["PENDING", "FRAUD_CHECK", "APPROVED"])
    ).scalar() or 0

    paid_hour = db.query(func.count(Claim.id)).filter(
        Claim.status == ClaimStatus.PAID,
        Claim.paid_at >= last_hour,
    ).scalar() or 0

    amount_hour = db.query(func.sum(Claim.payout_amount_inr)).filter(
        Claim.status == ClaimStatus.PAID,
        Claim.paid_at >= last_hour,
    ).scalar() or 0

    return {
        "pending_claims": pending,
        "paid_last_hour": paid_hour,
        "amount_paid_last_hour_inr": round(amount_hour, 2),
        "timestamp": now.isoformat(),
    }
