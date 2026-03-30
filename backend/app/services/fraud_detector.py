import json
import math
from datetime import datetime
from typing import List, Dict, Tuple
from app.db.redis_client import get_redis

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance between two GPS points in km."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

# Zone centroids for GPS validation
ZONE_CENTROIDS = {
    "T. Nagar":       (13.0344, 80.2337),
    "Adyar":          (13.0067, 80.2561),
    "Velachery":      (12.9780, 80.2209),
    "Porur":          (13.0343, 80.1583),
    "Anna Nagar":     (13.0850, 80.2101),
    "Sholinganallur": (12.9010, 80.2279),
    "Tambaram":       (12.9249, 80.1000),
    "Perambur":       (13.1143, 80.2329),
    "Mylapore":       (13.0368, 80.2676),
    "Guindy":         (13.0067, 80.2206),
}
GPS_THRESHOLD_KM = 5.0

def get_zone_centroid(zone: str) -> Tuple[float, float]:
    for key, coords in ZONE_CENTROIDS.items():
        if key.lower() in zone.lower() or zone.lower() in key.lower():
            return coords
    return (13.0827, 80.2707)  # Chennai center default

def check_fraud(
    rider_id: str,
    policy_id: str,
    zone: str,
    trigger_event_id: str,
    trigger_type: str,
    claim_time: datetime,
    rider_last_gps_lat: float,
    rider_last_gps_lng: float,
    rider_work_start: int,
    rider_work_end: int,
    rider_zone: str,
) -> Dict:
    flags: List[str] = []
    redis = get_redis()

    # ── Rule 1: Zone match ──
    if rider_zone.lower() not in zone.lower() and zone.lower() not in rider_zone.lower():
        flags.append("ZONE_MISMATCH")

    # ── Rule 2: GPS validation ──
    if rider_last_gps_lat and rider_last_gps_lng:
        centroid = get_zone_centroid(zone)
        distance = haversine_km(rider_last_gps_lat, rider_last_gps_lng, centroid[0], centroid[1])
        if distance > GPS_THRESHOLD_KM:
            flags.append(f"GPS_OUT_OF_ZONE:{distance:.1f}km")
    else:
        flags.append("NO_GPS_DATA")

    # ── Rule 3: Duplicate claim for same trigger event ──
    dedup_key = f"claim_dedup:{rider_id}:{trigger_event_id}"
    if redis.exists(dedup_key):
        flags.append("DUPLICATE_CLAIM")
    else:
        redis.setex(dedup_key, 86400 * 7, "1")  # expire after 7 days

    # ── Rule 4: Work hours check ──
    claim_hour = claim_time.hour
    if not (rider_work_start <= claim_hour <= rider_work_end):
        flags.append("OFF_HOURS_CLAIM")

    # ── Rule 5: Claim frequency (max 3 per week per rider) ──
    freq_key = f"claim_freq:{rider_id}:{claim_time.strftime('%Y-W%W')}"
    weekly_claims = redis.incr(freq_key)
    redis.expire(freq_key, 86400 * 7)
    if weekly_claims > 3:
        flags.append("HIGH_CLAIM_FREQUENCY")

    # ── Fraud score (0 = clean, 1 = very suspicious) ──
    fraud_score = min(len(flags) * 0.25, 1.0)

    # Determine action
    critical_flags = {"DUPLICATE_CLAIM", "HIGH_CLAIM_FREQUENCY"}
    has_critical = any(f in critical_flags for f in flags)

    if has_critical:
        action = "REJECT"
    elif len(flags) >= 2:
        action = "MANUAL_REVIEW"
    elif len(flags) == 1 and "NO_GPS_DATA" not in flags:
        action = "MANUAL_REVIEW"
    else:
        action = "AUTO_APPROVE"

    return {
        "passed": action == "AUTO_APPROVE",
        "action": action,
        "flags": flags,
        "fraud_score": fraud_score,
    }
