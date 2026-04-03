from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.db.database import get_db
from app.models.models import Rider
from app.routers.deps import get_current_rider
from app.services.premium_calculator import calculate_weekly_premium

router = APIRouter()

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    platform: str  # ZOMATO / SWIGGY
    zone: str
    pincode: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    avg_daily_hours: float = 8.0
    avg_daily_earnings: float = 800.0
    work_start_hour: int = 9
    work_end_hour: int = 21
    upi_id: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_name: Optional[str] = None

class GPSUpdate(BaseModel):
    lat: float
    lng: float

@router.get("/me")
def get_profile(rider: Rider = Depends(get_current_rider)):
    return {
        "id": rider.id,
        "phone": rider.phone,
        "name": rider.name,
        "platform": rider.platform,
        "zone": rider.zone,
        "avg_daily_hours": rider.avg_daily_hours,
        "avg_daily_earnings": rider.avg_daily_earnings,
        "upi_id": rider.upi_id,
        "bank_account_number": rider.bank_account_number,
        "bank_ifsc": rider.bank_ifsc,
        "bank_name": rider.bank_name,
        "is_active": rider.is_active,
    }

@router.post("/profile")
def update_profile(
    data: ProfileUpdate,
    rider: Rider = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    rider.name = data.name or rider.name
    rider.platform = data.platform
    rider.zone = data.zone
    rider.pincode = data.pincode
    rider.lat = data.lat
    rider.lng = data.lng
    rider.avg_daily_hours = data.avg_daily_hours
    rider.avg_daily_earnings = data.avg_daily_earnings
    rider.work_start_hour = data.work_start_hour
    rider.work_end_hour = data.work_end_hour
    rider.upi_id = data.upi_id
    rider.bank_account_number = data.bank_account_number
    rider.bank_ifsc = data.bank_ifsc
    rider.bank_name = data.bank_name
    db.commit()
    db.refresh(rider)

    # Return premium quote immediately
    quote = calculate_weekly_premium(
        zone=rider.zone,
        avg_daily_hours=rider.avg_daily_hours,
        avg_daily_earnings=rider.avg_daily_earnings,
    )
    return {"rider": {"id": rider.id, "zone": rider.zone}, "premium_quote": quote}

@router.post("/gps")
def update_gps(
    data: GPSUpdate,
    rider: Rider = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    from datetime import datetime
    rider.last_gps_lat = data.lat
    rider.last_gps_lng = data.lng
    rider.last_gps_at = datetime.utcnow()
    db.commit()
    return {"status": "ok"}
