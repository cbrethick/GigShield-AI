from app.db.database import SessionLocal
from app.models.models import Claim, Rider
db = SessionLocal()
claim = db.query(Claim).filter(Claim.trigger_event_id == "HEAVY_RAIN:T._Nagar:202604131336").first()
print(f"Claim Status: {claim.status}")
print(f"Rider UPI: {claim.rider.upi_id}")
print(f"Rider Bank: {claim.rider.bank_account_number}")
db.close()
