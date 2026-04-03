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
    Parametric Settlement Pipeline (1-5 Steps)
    """
    now = datetime.utcnow()

    # ── STEP 1: Trigger Confirmed ──
    # Weather API or system detects event threshold crossed.
    event = TriggerEvent(
        id=trigger_event_id,
        zone=zone,
        trigger_type=trigger_type,
        trigger_value=trigger_value,
        threshold=threshold,
        platform_status=platform_status,
        raw_data=json.dumps({"duration_hours": duration_hours, "source": "WeatherAPI"}),
    )
    db.add(event)
    db.commit()

    # ── STEP 2: Worker Eligibility Check ──
    # 1. Active policy in this zone
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

        # 2. Check for duplicate claim (don't pay twice for the same event)
        duplicate = db.query(Claim).filter(
            Claim.rider_id == rider.id,
            Claim.trigger_event_id == trigger_event_id
        ).first()
        if duplicate:
            continue

        # ── STEP 3: Payout Calculated ──
        # Formula: Fixed amount per hour × trigger duration
        # Example: ₹100/hr × 4 hrs = ₹400
        hourly_rate = rider.avg_daily_earnings / max(rider.avg_daily_hours, 1)
        payout = round(min(duration_hours * hourly_rate, policy.max_payout_inr), 2)
        
        calc_formula = f"₹{round(hourly_rate,2)}/hr × {duration_hours} hrs"

        # ── FRAUD CHECK BEFORE PAYMENT ──
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

        # Create claim record
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
            payout_details=json.dumps({"formula": calc_formula, "hourly_rate": hourly_rate}),
            status=ClaimStatus.FRAUD_CHECK,
            fraud_score=fraud_result["fraud_score"],
            fraud_flags=json.dumps(fraud_result["flags"]),
        )
        db.add(claim)
        db.flush()

        # Step 4 logic depends on fraud result
        if fraud_result["action"] == "AUTO_APPROVE":
            claim.status = ClaimStatus.APPROVED
            results["approved"] += 1
            results["total_payout_inr"] += payout

            # ── STEP 4: Transfer Initiated ──
            # Failover logic: UPI (Primary) -> IMPS (Backup)
            payout_result = None
            try:
                # 4.1 Try UPI first
                if rider.upi_id:
                    fund = await create_fund_account(rider.id, upi_id=rider.upi_id)
                    payout_result = await process_payout(
                        claim_id=claim.id,
                        rider_id=rider.id,
                        fund_account_id=fund["id"],
                        amount_inr=payout,
                        mode="UPI",
                        upi_id=rider.upi_id
                    )
                    claim.payout_mode = "UPI"
                
                # 4.2 Fallback to IMPS if UPI fails or is missing
                if (not payout_result or payout_result.get("status") == "failed") and rider.bank_account_number:
                    print(f"[Fallback] UPI failed or missing for {rider.id}, attempting IMPS...")
                    bank_info = {
                        "name": rider.name or "Rider",
                        "ifsc": rider.bank_ifsc,
                        "account_number": rider.bank_account_number
                    }
                    fund = await create_fund_account(rider.id, bank_details=bank_info)
                    payout_result = await process_payout(
                        claim_id=claim.id,
                        rider_id=rider.id,
                        fund_account_id=fund["id"],
                        amount_inr=payout,
                        mode="IMPS"
                    )
                    claim.payout_mode = "IMPS"

            except Exception as e:
                print(f"[Settlement] Step 4 failed: {e}")
                claim.status = ClaimStatus.PAYOUT_FAILED

            # ── STEP 5: Record Updated ──
            if payout_result and payout_result.get("status") in ("processed", "processing"):
                claim.status = ClaimStatus.APPROVED # Will be updated to PAID by webhook/mock delay
                claim.razorpay_payout_id = payout_result.get("id")
            elif payout_result:
                claim.status = ClaimStatus.PAYOUT_FAILED

        elif fraud_result["action"] == "MANUAL_REVIEW":
            claim.status = ClaimStatus.MANUAL_REVIEW
            results["manual_review"] += 1
        else:
            claim.status = ClaimStatus.REJECTED
            results["rejected"] += 1

        results["claims_created"] += 1

    # Final update to event record
    event.claims_created = results["claims_created"]
    db.commit()

    return results
