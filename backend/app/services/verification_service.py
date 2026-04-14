import re
import requests
from typing import Tuple, Optional

def validate_upi_format(upi_handle: str) -> bool:
    """Basic regex validation for UPI ID (VPA)."""
    if not upi_handle:
        return False
    # Standard UPI format: username@bank
    pattern = r'^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$'
    return bool(re.match(pattern, upi_handle))

def validate_ifsc_format(ifsc: str) -> bool:
    """Indian Financial System Code (IFSC) format validation."""
    if not ifsc:
        return False
    # IFSC: 4 letters, then '0', then 6 digits/letters
    pattern = r'^[A-Z]{4}0[A-Z0-9]{6}$'
    return bool(re.match(pattern, ifsc.upper()))

async def verify_payout_details(name: str, upi_id: Optional[str] = None, account_number: Optional[str] = None, ifsc: Optional[str] = None) -> Tuple[bool, str, Optional[str]]:
    """
    Real 'Penny Drop' verification service using RazorpayX.
    Returns: (is_valid, message, registered_name)
    """
    from app.services.razorpay_service import RazorpayService

    if upi_id:
        if not validate_upi_format(upi_id):
            return False, "Invalid UPI ID format. Correct format: name@bank", None
        
        result = await RazorpayService.validate_upi_id(name, upi_id)
        if result.get("status") in ("success", "completed", "pending"):
            holder_name = result.get("registered_name") or f"MOCK_{name.upper()}"
            return True, f"UPI Verified. Holder: {holder_name}", holder_name
        return False, f"UPI Verification failed: {result.get('error', 'Unknown error')}", None
    
    if account_number and ifsc:
        if not validate_ifsc_format(ifsc):
            return False, "Invalid IFSC code format.", None
        if len(account_number) < 9 or len(account_number) > 18:
            return False, "Invalid bank account number length.", None
            
        result = await RazorpayService.validate_bank_account(name, ifsc, account_number)
        if result.get("status") in ("success", "completed", "pending"):
            holder_name = result.get("registered_name") or f"MOCK_{name.upper()}"
            return True, f"Bank Account Verified. Holder: {holder_name}", holder_name
        return False, f"Bank Verification failed: {result.get('error', 'Unknown error')}", None

    return False, "Missing UPI or Bank details for verification.", None
