import os
import httpx
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "rzp_test_demo")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "demo_secret")
MOCK_MODE           = os.getenv("ENVIRONMENT", "production") == "development"

async def create_fund_account(rider_id: str, upi_id: str, name: str) -> dict:
    """Create or retrieve Razorpay fund account for rider."""
    if MOCK_MODE or not RAZORPAY_KEY_ID.startswith("rzp_"):
        return {
            "id": f"fa_mock_{rider_id[:8]}",
            "entity": "fund_account",
            "account_type": "vpa",
            "mock": True,
        }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.razorpay.com/v1/fund_accounts",
                auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
                json={
                    "contact_id": rider_id,
                    "account_type": "vpa",
                    "vpa": {"address": upi_id},
                },
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
    upi_id: str = None,
) -> dict:
    """Initiate UPI payout via Razorpay sandbox."""
    amount_paise = int(amount_inr * 100)

    if MOCK_MODE or not RAZORPAY_KEY_ID.startswith("rzp_") or not fund_account_id.startswith("fa_"):
        print(f"[MOCK PAYOUT] Claim {claim_id} | Rider {rider_id} | ₹{amount_inr} | UPI: {upi_id}")
        return {
            "id": f"pay_mock_{claim_id[:8]}",
            "status": "processed",
            "amount": amount_paise,
            "currency": "INR",
            "mode": "UPI",
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
                    "mode": "UPI",
                    "purpose": "insurance_claim",
                    "queue_if_low_balance": True,
                    "reference_id": f"GS-CLM-{claim_id[:8]}",
                    "narration": "GigShield income protection payout",
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
