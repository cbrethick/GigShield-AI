import os
import httpx
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
ENVIRONMENT         = os.getenv("ENVIRONMENT", "development")

# Use MOCK_MODE only if keys are missing or specifically explicitly set to mock
MOCK_MODE = not RAZORPAY_KEY_ID.startswith("rzp_")

async def create_fund_account(rider_id: str, upi_id: str = None, bank_details: dict = None) -> dict:
    """Create or retrieve Razorpay fund account for rider (UPI or Bank)."""
    if MOCK_MODE:
        return {
            "id": f"fa_mock_{rider_id[:8]}",
            "entity": "fund_account",
            "mock": True,
        }
    
    # RazorpayService handles the actual FA creation during validation/onboarding
    # In full flow, we'd fetch the FA from DB. For demo, we might create a contact+FA on the fly
    return await RazorpayService.validate_upi_id("Rider", upi_id) if upi_id else {"id": f"fa_placeholder_{rider_id[:8]}"}

async def process_payout(
    claim_id: str,
    rider_id: str,
    fund_account_id: str,
    amount_inr: float,
    mode: str = "UPI", # UPI or IMPS
    upi_id: str = None,
) -> dict:
    """Initiate real payout via RazorpayX (UPI or IMPS)."""
    amount_paise = int(amount_inr * 100)
    
    if MOCK_MODE:
        print(f"[MOCK PAYOUT] Step 4: Transfer Initiated | Claim {claim_id} | Mode: {mode} | ₹{amount_inr}")
        # Demo Mode: Always succeed
        return {
            "id": f"pout_{uuid.uuid4().hex[:14]}",
            "status": "processed",
            "amount": amount_inr * 100,
            "currency": "INR",
            "mode": mode,
            "reference_id": f"GS-CLM-{claim_id}",
        }

    # Real RazorpayX Payout Implementation
    try:
        amount_paise = int(amount_inr * 100)
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.razorpay.com/v1/payouts",
                auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
                json={
                    "account_number": os.getenv("RAZORPAYX_ACCOUNT_NUMBER", ""),
                    "fund_account_id": fund_account_id,
                    "amount": amount_paise,
                    "currency": "INR",
                    "mode": mode if mode == "UPI" else "IMPS",
                    "purpose": "insurance_claim",
                    "queue_if_low_balance": True,
                    "reference_id": f"GS-CLM-{claim_id[:8]}",
                    "narration": f"GigShield {mode} Claim Payout",
                },
                timeout=15,
            )
            data = resp.json()
            if "error" in data:
                print(f"[Razorpay] Payout error: {data['error']['description']}")
            return data
    except Exception as e:
        print(f"[Razorpay] Connection error: {e}")
        return {"status": "failed", "error": str(e)}

async def validate_bank_account(name: str, account_number: str, ifsc: str):
    """Refactored to use RazorpayService."""
    return await RazorpayService.validate_bank_account(name, ifsc, account_number)

async def validate_vpa(name: str, vpa: str):
    """Refactored to use RazorpayService."""
    return await RazorpayService.validate_upi_id(name, vpa)
