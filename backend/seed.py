"""
Seed the database with demo data for presentation.
Run: python backend/seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app.db.database import SessionLocal, engine, Base
from app.models.models import Rider, Policy, Claim, TriggerEvent, PolicyStatus, ClaimStatus
from app.services.premium_calculator import calculate_weekly_premium
from datetime import datetime, timedelta
import uuid, json, random

Base.metadata.create_all(bind=engine)
db = SessionLocal()

print("Seeding demo data...")

ZONES = [
    ("T. Nagar", 13.0344, 80.2337),
    ("Adyar", 13.0067, 80.2561),
    ("Velachery", 12.9780, 80.2209),
    ("Porur", 13.0343, 80.1583),
    ("Anna Nagar", 13.0850, 80.2101),
]

NAMES = [
    "Ravi Kumar", "Suresh Babu", "Muthu Raja", "Karthik S",
    "Priya Devi", "Anand M", "Venkat R", "Deepak N",
    "Ramesh K", "Sathish P", "Vijay T", "Arun B",
]

riders_created = []

# Create demo riders
for i, name in enumerate(NAMES):
    phone = f"98765{str(i+1).zfill(5)}"
    existing = db.query(Rider).filter(Rider.phone == phone).first()
    if existing:
        riders_created.append(existing)
        continue

    zone_info = ZONES[i % len(ZONES)]
    hours = random.choice([6, 8, 10])
    earn = random.randint(600, 1100)

    rider = Rider(
        id=str(uuid.uuid4()),
        phone=phone,
        name=name,
        platform=random.choice(["ZOMATO", "SWIGGY"]),
        zone=zone_info[0],
        lat=zone_info[1],
        lng=zone_info[2],
        last_gps_lat=zone_info[1] + random.uniform(-0.01, 0.01),
        last_gps_lng=zone_info[2] + random.uniform(-0.01, 0.01),
        last_gps_at=datetime.utcnow() - timedelta(minutes=random.randint(1, 60)),
        avg_daily_hours=hours,
        avg_daily_earnings=earn,
        work_start_hour=9,
        work_end_hour=21,
        upi_id=f"{name.split()[0].lower()}{phone[-4:]}@okicici",
        bank_account_number=f"501004{random.randint(100000,999999)}",
        bank_ifsc="HDFC0001234",
        bank_name="HDFC Bank",
    )
    db.add(rider)
    db.flush()
    riders_created.append(rider)

    # Create active policy
    quote = calculate_weekly_premium(zone_info[0], hours, earn)
    now = datetime.utcnow()
    days_to_sunday = (6 - now.weekday()) % 7 or 7

    policy = Policy(
        id=str(uuid.uuid4()),
        rider_id=rider.id,
        policy_number=f"GS-202603-{str(i+1).zfill(4)}",
        zone=zone_info[0],
        weekly_premium_inr=quote["weekly_premium_inr"],
        max_payout_inr=quote["max_payout_inr"],
        coverage_hours_per_event=quote["coverage_hours_per_event"],
        risk_score=quote["risk_score"],
        status=PolicyStatus.ACTIVE,
        valid_from=now - timedelta(days=3),
        valid_till=now + timedelta(days=days_to_sunday),
        triggers=json.dumps(["HEAVY_RAIN","FLOOD","SEVERE_AQI","PLATFORM_PAUSE","CURFEW"]),
    )
    db.add(policy)
    db.flush()

    # Create 1-3 historical claims per rider
    num_claims = random.randint(1, 3)
    for j in range(num_claims):
        claim_date = now - timedelta(days=random.randint(1, 21))
        trigger = random.choice(["HEAVY_RAIN","FLOOD","SEVERE_AQI"])
        duration = random.choice([3, 4, 5, 6])
        hourly = earn / hours
        payout = round(min(duration * hourly, quote["max_payout_inr"]), 2)
        status = random.choices(
            [ClaimStatus.PAID, ClaimStatus.MANUAL_REVIEW, ClaimStatus.REJECTED],
            weights=[0.80, 0.15, 0.05], k=1
        )[0]

        claim = Claim(
            id=str(uuid.uuid4()),
            claim_number=f"GS-CLM-{claim_date.strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}",
            rider_id=rider.id,
            policy_id=policy.id,
            trigger_type=trigger,
            trigger_event_id=f"{trigger}:{zone_info[0].replace(' ','_')}:{claim_date.strftime('%Y%m%d%H')}",
            trigger_value=random.uniform(65, 120) if trigger != "SEVERE_AQI" else random.uniform(400, 480),
            trigger_threshold=64 if trigger != "SEVERE_AQI" else 400,
            zone=zone_info[0],
            duration_hours=duration,
            payout_amount_inr=payout,
            payout_mode=random.choice(["UPI", "IMPS"]),
            payout_details=json.dumps({"formula": f"₹{round(hourly,2)}/hr × {duration} hrs", "hourly_rate": hourly}),
            status=status,
            fraud_score=random.uniform(0, 0.2),
            fraud_flags=json.dumps([]),
            razorpay_payout_id=f"pay_demo_{str(uuid.uuid4())[:8]}" if status == ClaimStatus.PAID else None,
            paid_at=claim_date + timedelta(minutes=random.randint(5, 15)) if status == ClaimStatus.PAID else None,
            created_at=claim_date,
        )
        db.add(claim)

db.commit()
print(f"Created {len(riders_created)} riders with policies and claims")

# Create a demo trigger event
event = TriggerEvent(
    id=str(uuid.uuid4()),
    zone="T. Nagar",
    trigger_type="HEAVY_RAIN",
    trigger_value=78.2,
    threshold=64.0,
    platform_status="PAUSED",
    raw_data=json.dumps({"duration_hours": 4, "source": "OpenWeatherMap", "mocked": False}),
    claims_created=len([r for r in riders_created if r.zone == "T. Nagar"]),
)
db.add(event)
db.commit()

print("Seed complete! Demo data ready.")
print(f"\nDemo login phones:")
for r in riders_created[:3]:
    print(f"  +91{r.phone} | OTP: 123456 | Zone: {r.zone}")

db.close()
