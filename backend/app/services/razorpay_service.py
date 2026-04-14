import os
import requests
import json
from typing import Dict, Optional, Tuple
from requests.auth import HTTPBasicAuth

# Razorpay X Payouts & Validation Service
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RAZORPAYX_ACCOUNT_NUMBER = os.getenv("RAZORPAYX_ACCOUNT_NUMBER")

BASE_URL = "https://api.razorpay.com/v1"

class RazorpayService:
    @staticmethod
    def _get_auth():
        return HTTPBasicAuth(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)

    @classmethod
    async def validate_bank_account(cls, name: str, ifsc: str, account_number: str) -> Dict:
        """
        RazorpayX Penny Drop validation for Bank Accounts.
        """
        if not RAZORPAY_KEY_ID or "dummy" in RAZORPAY_KEY_ID or not RAZORPAYX_ACCOUNT_NUMBER or "XXX" in RAZORPAYX_ACCOUNT_NUMBER:
            # ROI/Simulation mode
            return {"status": "success", "registered_name": f"MOCK_{name.upper()}", "mock": True}

        try:
            # 1. Create/Get Contact (Simplified for demo)
            contact_res = requests.post(
                f"{BASE_URL}/contacts",
                auth=cls._get_auth(),
                json={
                    "name": name,
                    "type": "rider",
                    "reference_id": f"GS_REF_{account_number[-4:]}"
                }
            )
            contact_data = contact_res.json()
            if "error" in contact_data:
                return {"status": "failed", "error": contact_data["error"].get("description", "Contact API error")}
            contact_id = contact_data.get("id")

            # 2. Create Fund Account
            fa_res = requests.post(
                f"{BASE_URL}/fund_accounts",
                auth=cls._get_auth(),
                json={
                    "contact_id": contact_id,
                    "account_type": "bank_account",
                    "bank_account": {
                        "name": name,
                        "ifsc": ifsc,
                        "account_number": account_number
                    }
                }
            )
            fa_data = fa_res.json()
            if "error" in fa_data:
                return {"status": "failed", "error": fa_data["error"].get("description", "Fund Account API error")}
            fund_account_id = fa_data.get("id")

            # 3. Validate (Penny Drop)
            val_res = requests.post(
                f"{BASE_URL}/fund_accounts/validations",
                auth=cls._get_auth(),
                json={
                    "account_number": RAZORPAYX_ACCOUNT_NUMBER,
                    "fund_account_id": fund_account_id,
                    "amount": 100, # 100 paise = ₹1
                    "currency": "INR",
                    "notes": {"purpose": "GigShield Rider Onboarding"}
                }
            )
            data = val_res.json()
            if "error" in data:
                return {"status": "failed", "error": data["error"].get("description", "Validation API error")}
                
            return {
                "status": data.get("status"),
                "registered_name": data.get("results", {}).get("registered_name"),
                "fund_account_id": fund_account_id,
                "reference_id": data.get("id")
            }
        except Exception as e:
            print(f"[Razorpay] Validation error: {e}")
            return {"status": "failed", "error": str(e)}

    @classmethod
    async def validate_upi_id(cls, name: str, vpa: str) -> Dict:
        """
        RazorpayX VPA validation.
        """
        if not RAZORPAY_KEY_ID or "dummy" in RAZORPAY_KEY_ID or not RAZORPAYX_ACCOUNT_NUMBER or "XXX" in RAZORPAYX_ACCOUNT_NUMBER:
            return {"status": "success", "registered_name": f"MOCK_{name.upper()}", "mock": True}

        try:
            # 1. Create Contact
            contact_res = requests.post(
                f"{BASE_URL}/contacts",
                auth=cls._get_auth(),
                json={"name": name, "type": "rider"}
            )
            contact_data = contact_res.json()
            if "error" in contact_data:
                return {"status": "failed", "error": contact_data["error"].get("description", "Contact API error")}
            contact_id = contact_data.get("id")

            # 2. Create Fund Account (UPI)
            fa_res = requests.post(
                f"{BASE_URL}/fund_accounts",
                auth=cls._get_auth(),
                json={
                    "contact_id": contact_id,
                    "account_type": "vpa",
                    "vpa": {"address": vpa}
                }
            )
            fa_data = fa_res.json()
            if "error" in fa_data:
                return {"status": "failed", "error": fa_data["error"].get("description", "Fund Account API error")}
            fund_account_id = fa_data.get("id")

            # 3. Validate
            val_res = requests.post(
                f"{BASE_URL}/fund_accounts/validations",
                auth=cls._get_auth(),
                json={
                    "account_number": RAZORPAYX_ACCOUNT_NUMBER,
                    "fund_account_id": fund_account_id,
                    "amount": 100,
                    "currency": "INR"
                }
            )
            data = val_res.json()
            if "error" in data:
                return {"status": "failed", "error": data["error"].get("description", "Validation API error")}
                
            return {
                "status": data.get("status"),
                "registered_name": data.get("results", {}).get("registered_name"),
                "fund_account_id": fund_account_id
            }
        except Exception as e:
            return {"status": "failed", "error": str(e)}
