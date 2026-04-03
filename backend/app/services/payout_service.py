import os
import httpx
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "rzp_test_demo")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "demo_secret")
MOCK_MODE           = os.getenv("ENVIRONMENT", "production") == "development"

async def create_fund_account(rider_id: str, upi_id: str = None, bank_details: dict = None) -> dict:
    """Create or retrieve Razorpay fund account for rider (UPI or Bank)."""
    if MOCK_MODE or not RAZORPAY_KEY_ID.startswith("rzp_"):
        return {
            "id": f"fa_mock_{rider_id[:8]}",
            "entity": "fund_account",
            "account_type": "vpa" if upi_id else "bank_account",
            "mock": True,
        }
    
    payload = {"contact_id": rider_id}
    if upi_id:
        payload.update({
            "account_type": "vpa",
            "vpa": {"address": upi_id},
        })
    elif bank_details:
        payload.update({
            "account_type": "bank_account",
            "bank_account": {
                "name": bank_details.get("name"),
                "ifsc": bank_details.get("ifsc"),
                "account_number": bank_details.get("account_number"),
            },
        })
    else:
        raise ValueError("Either upi_id or bank_details must be provided")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.razorpay.com/v1/fund_accounts",
                auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
                json=payload,
                timeout=10,
            )
            return resp.json()
    except Exception as e:
        print(f"[Razorpay] fund_account error: {e}")
        return {"id": f"fa_fallback_{rider_id[:8]}", "mock": True}

async def process_payout(
    claim_id: str,
    rider_id: str,
    fund_account_id: str,
    amount_inr: float,
    mode: str = "UPI", # UPI or IMPS
    upi_id: str = None,
) -> dict:
    """Initiate payout via Razorpay (UPI or IMPS)."""
    amount_paise = int(amount_inr * 100)

    if MOCK_MODE or not RAZORPAY_KEY_ID.startswith("rzp_") or not fund_account_id.startswith("fa_"):
        print(f"[MOCK PAYOUT] Step 4: Transfer Initiated | Claim {claim_id} | Mode: {mode} | ₹{amount_inr}")
        return {
            "id": f"pay_mock_{claim_id[:8]}",
            "status": "processed",
            "amount": amount_paise,
            "currency": "INR",
            "mode": mode,
            "reference_id": f"GS-CLM-{claim_id[:8]}",
            "mock": True,
        }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.razorpay.com/v1/payouts",
                auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
                json={
                    "account_number": os.getenv("RAZORPAY_ACCOUNT_NUMBER", ""),
                    "fund_account_id": fund_account_id,
                    "amount": amount_paise,
                    "currency": "INR",
                    "mode": mode, # UPI or IMPS
                    "purpose": "insurance_claim",
                    "queue_if_low_balance": True,
                    "reference_id": f"GS-CLM-{claim_id[:8]}",
                    "narration": f"GigShield {mode} Claim Payout",
                },
                timeout=15,
            )
            return resp.json()
    except Exception as e:
        print(f"[Razorpay] payout error: {e}")
        return {
            "id": f"pay_err_{claim_id[:8]}",
            "status": "failed",
            "error": str(e),
        }
