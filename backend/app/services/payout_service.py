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
        print(f"Payout Error: {str(e)}")
        return {"status": "failed", "error": str(e)}

def validate_bank_account(account_number: str, ifsc: str):
    """Real-time bank verification (Penny Drop) using RazorpayX."""
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        # Mock mode
        return {"status": "active", "results": {"account_holder_name": "Demo User (Verified)"}}

    import requests
    try:
        # 1. Create a dummy contact for validation
        contact_res = requests.post(f"{RAZORPAYX_API_BASE}/contacts", 
            auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
            json={"name": "Verification User", "type": "vendor", "reference_id": f"ref_{int(datetime.utcnow().timestamp())}"})
        contact_id = contact_res.json().get("id")

        # 2. Create fund account
        fund_res = requests.post(f"{RAZORPAYX_API_BASE}/fund_accounts",
            auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
            json={
                "contact_id": contact_id,
                "account_type": "bank_account",
                "bank_account": {"name": "Verification", "ifsc": ifsc, "account_number": account_number}
            })
        fund_account_id = fund_res.json().get("id")

        # 3. Trigger Validation (Penny Drop)
        validate_res = requests.post(f"{RAZORPAYX_API_BASE}/fund_accounts/validations",
            auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
            json={"fund_account_id": fund_account_id, "amount": 100}) # 100 paise = 1 INR
        
        return validate_res.json()
    except Exception as e:
        print(f"Validation Error: {str(e)}")
        return {"status": "failed", "error": str(e)}

def validate_vpa(vpa: str):
    """Real-time UPI ID verification using RazorpayX."""
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        return {"status": "active", "results": {"customer_name": "Demo User (Verified)"}}

    import requests
    try:
        # Similar flow to bank but for VPA
        contact_res = requests.post(f"{RAZORPAYX_API_BASE}/contacts", 
            auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
            json={"name": "VPA Verification", "type": "customer"})
        contact_id = contact_res.json().get("id")

        fund_res = requests.post(f"{RAZORPAYX_API_BASE}/fund_accounts",
            auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
            json={
                "contact_id": contact_id,
                "account_type": "vpa",
                "vpa": {"address": vpa}
            })
        fund_account_id = fund_res.json().get("id")

        validate_res = requests.post(f"{RAZORPAYX_API_BASE}/fund_accounts/validations",
            auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
            json={"fund_account_id": fund_account_id})
        
        return validate_res.json()
    except Exception as e:
        print(f"VPA Validation Error: {str(e)}")
        return {"status": "failed", "error": str(e)}
