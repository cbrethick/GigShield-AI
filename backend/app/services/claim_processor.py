import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.models import Policy, Claim, Rider, TriggerEvent, PolicyStatus, ClaimStatus
from app.services.fraud_detector import check_fraud
from app.services.payout_service import process_payout, create_fund_account
import uuid

def gen_claim_number() -> str:
    now = datetime.utcnow()
    return f"GS-CLM-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

async def process_trigger_event(
    db: Session,
    zone: str,
    trigger_type: str,
    trigger_value: float,
    threshold: float,
    platform_status: str,
    trigger_event_id: str,
    duration_hours: float = 4.0,
) -> dict:
    """
    Core automation: given a trigger event, find all active policies
    in the zone, run fraud checks, and initiate payouts.
    """
    now = datetime.utcnow()

    # 1. Log the trigger event
    event = TriggerEvent(
        id=trigger_event_id,
        zone=zone,
        trigger_type=trigger_type,
        trigger_value=trigger_value,
        threshold=threshold,
        platform_status=platform_status,
        raw_data=json.dumps({"duration_hours": duration_hours}),
    )
    db.add(event)
    db.commit()

    # 2. Find all active policies for this zone
    active_policies = db.query(Policy).filter(
        Policy.zone.ilike(f"%{zone.split()[0]}%"),
        Policy.status == PolicyStatus.ACTIVE,
        Policy.valid_till >= now,
    ).all()

    if not active_policies:
        return {"claims_created": 0, "zone": zone, "trigger": trigger_type}

    results = {"claims_created": 0, "approved": 0, "manual_review": 0, "rejected": 0, "total_payout_inr": 0}

    for policy in active_policies:
        rider: Rider = policy.rider

        # 3. Calculate payout amount
        hourly_rate = rider.avg_daily_earnings / max(rider.avg_daily_hours, 1)
        payout = round(min(duration_hours * hourly_rate, policy.max_payout_inr), 2)

        # 4. Run fraud detection
        fraud_result = check_fraud(
            rider_id=rider.id,
            policy_id=policy.id,
            zone=zone,
            trigger_event_id=trigger_event_id,
            trigger_type=trigger_type,
            claim_time=now,
            rider_last_gps_lat=rider.last_gps_lat,
            rider_last_gps_lng=rider.last_gps_lng,
            rider_work_start=rider.work_start_hour,
            rider_work_end=rider.work_end_hour,
            rider_zone=rider.zone,
        )

        # 5. Create claim record
        claim = Claim(
            claim_number=gen_claim_number(),
            rider_id=rider.id,
            policy_id=policy.id,
            trigger_type=trigger_type,
            trigger_event_id=trigger_event_id,
            trigger_value=trigger_value,
            trigger_threshold=threshold,
            zone=zone,
            duration_hours=duration_hours,
            payout_amount_inr=payout,
            status=ClaimStatus.FRAUD_CHECK,
            fraud_score=fraud_result["fraud_score"],
            fraud_flags=json.dumps(fraud_result["flags"]),
        )
        db.add(claim)
        db.flush()

        # 6. Process based on fraud result
        if fraud_result["action"] == "AUTO_APPROVE":
            claim.status = ClaimStatus.APPROVED
            results["approved"] += 1
            results["total_payout_inr"] += payout

            # 7. Initiate payout
            fund_account_id = rider.id  # simplified; real: store razorpay fund_account_id
            payout_result = await process_payout(
                claim_id=claim.id,
                rider_id=rider.id,
                fund_account_id=fund_account_id,
                amount_inr=payout,
                upi_id=rider.upi_id or f"{rider.phone}@upi",
            )

            if payout_result.get("status") in ("processed", "processing"):
                # Set to APPROVED initially. A background task will update to PAID after 10s.
                claim.status = ClaimStatus.APPROVED
                claim.razorpay_payout_id = payout_result.get("id")
            else:
                claim.status = ClaimStatus.APPROVED

        elif fraud_result["action"] == "MANUAL_REVIEW":
            claim.status = ClaimStatus.MANUAL_REVIEW
            results["manual_review"] += 1
        else:
            claim.status = ClaimStatus.REJECTED
            results["rejected"] += 1

        results["claims_created"] += 1

    # Update trigger event record
    event.claims_created = results["claims_created"]
    db.commit()

    return results
