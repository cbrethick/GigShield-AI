from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import httpx
from pydantic import BaseModel
from app.db.database import get_db
from app.services.payout_service import validate_bank_account, validate_vpa
from typing import Optional

router = APIRouter()

class BankVerifyRequest(BaseModel):
    account_number: str
    ifsc: str

class UPIVerifyRequest(BaseModel):
    vpa: str

@router.get("/ifsc/{code}")
async def get_ifsc_details(code: str):
    """Fetch bank name and branch from Razorpay IFSC API."""
    if not code or len(code) != 11:
        raise HTTPException(status_code=400, detail="Invalid IFSC code format")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"https://ifsc.razorpay.com/{code}")
            if response.status_code == 200:
                data = response.json()
                return {
                    "bank": data.get("BANK"),
                    "branch": data.get("BRANCH"),
                    "city": data.get("CITY"),
                    "state": data.get("STATE"),
                }
            else:
                raise HTTPException(status_code=404, detail="IFSC not found")
        except Exception as e:
            raise HTTPException(status_code=500, detail="Error fetching IFSC details")

@router.post("/bank")
async def verify_bank(req: BankVerifyRequest):
    """Trigger a real Penny Drop via Razorpay."""
    try:
        result = validate_bank_account(req.account_number, req.ifsc)
        if result and result.get("status") == "active":
            return {
                "success": True,
                "account_holder_name": result.get("results", {}).get("account_holder_name", "Verified User"),
                "details": result
            }
        else:
            return {"success": False, "message": "Verification failed. Check your bank details."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/vpa")
async def verify_vpa(req: UPIVerifyRequest):
    """Verify a UPI ID (VPA) via Razorpay."""
    try:
        result = validate_vpa(req.vpa)
        if result and result.get("status") == "active":
            return {
                "success": True,
                "customer_name": result.get("results", {}).get("customer_name", "Verified User"),
                "details": result
            }
        else:
            return {"success": False, "message": "Invalid UPI ID"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
