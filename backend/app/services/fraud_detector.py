import json
import math
import os
import pickle
import numpy as np
from datetime import datetime
from typing import List, Dict, Tuple
from app.db.redis_client import get_redis

from app.services.ml_engine import ml_engine

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
    
    # ML Features
    ml_features = {
        "loc_variance": 0.01, # Default normal
        "avg_speed": 20.0,
        "ping_interval_std": 60.0,
        "claim_rate": 0
    }

    # ── Rule 1: Zone match ──
    if rider_zone.lower() not in zone.lower() and zone.lower() not in rider_zone.lower():
        flags.append("ZONE_MISMATCH")

    # ── Rule 2: GPS validation & Spoofing Detection ──
    if rider_last_gps_lat and rider_last_gps_lng:
        centroid = get_zone_centroid(zone)
        distance = haversine_km(rider_last_gps_lat, rider_last_gps_lng, centroid[0], centroid[1])
        
        if distance > GPS_THRESHOLD_KM:
            flags.append(f"GPS_OUT_OF_ZONE:{distance:.1f}km")

        # Velocity & Variance Check
        history_key = f"gps_history:{rider_id}"
        history_data = redis.get(history_key)
        history = json.loads(history_data) if history_data else []
        
        if history:
            prev = history[-1]
            prev_lat, prev_lng, prev_time_str = prev["lat"], prev["lng"], prev["time"]
            prev_time = datetime.fromisoformat(prev_time_str)
            
            time_diff_sec = (claim_time - prev_time).total_seconds()
            if time_diff_sec > 0:
                dist_moved = haversine_km(rider_last_gps_lat, rider_last_gps_lng, prev_lat, prev_lng)
                speed_kmh = (dist_moved / time_diff_sec) * 3600
                ml_features["avg_speed"] = speed_kmh
                
                if speed_kmh > 120:
                    flags.append(f"GPS_SPOOFING_DETECTED:{speed_kmh:.0f}km/h")
            
            # Calculate variance if we have at least 3 points
            if len(history) >= 2:
                lats = [p["lat"] for p in history] + [rider_last_gps_lat]
                lngs = [p["lng"] for p in history] + [rider_last_gps_lng]
                ml_features["loc_variance"] = np.var(lats) + np.var(lngs)
                
                # Check for "Zero-Variance" spoofing (fixed point)
                if ml_features["loc_variance"] < 0.000001:
                    flags.append("FIXED_LOCATION_SPOOF")

        # Update History in Redis (keep last 5)
        history.append({"lat": rider_last_gps_lat, "lng": rider_last_gps_lng, "time": claim_time.isoformat()})
        redis.setex(history_key, 3600, json.dumps(history[-5:]))
    else:
        flags.append("NO_GPS_DATA")

    # ── Rule 3: Duplicate claim ──
    dedup_key = f"claim_dedup:{rider_id}:{trigger_event_id}"
    if redis.exists(dedup_key):
        flags.append("DUPLICATE_CLAIM")
    else:
        redis.setex(dedup_key, 86400 * 7, "1")

    # ── Rule 4: Work hours ──
    claim_hour = claim_time.hour
    if not (rider_work_start <= claim_hour <= rider_work_end):
        flags.append("OFF_HOURS_CLAIM")

    # ── Rule 5: Historical Data Consistency (IMD Check) ──
    verified_key = f"system_verified_trigger:{trigger_event_id}"
    if not redis.exists(verified_key) and "demo" not in trigger_event_id:
        flags.append("FAKE_WEATHER_CLAIM")

    # ── ML MODEL INFERENCE (Isolation Forest) ──
    ml_input = {
        "zone_flood_score": 5 if "Anna" in zone else 3, # Mock contextual features for demo
        "disruption_freq_90d": 2,
        "avg_daily_earnings": 800,
        "avg_daily_hours": 8,
        "avg_rider_rating": 4.5,
        "disruption_days": 1
    }
    
    ml_fraud_score = ml_engine.evaluate_fraud(ml_input)
    if ml_fraud_score > 0.6:
        flags.append(f"BEHAVIORAL_ANOMALY_DETECTED:{ml_fraud_score:.2f}")

    # ── Fraud score Calculation ──
    fraud_score = min(len(flags) * 0.2, 1.0)

    # Determine action
    critical_flags = {"DUPLICATE_CLAIM", "GPS_SPOOFING_DETECTED", "FAKE_WEATHER_CLAIM", "FIXED_LOCATION_SPOOF"}
    has_critical = any(f.split(":")[0] in critical_flags for f in flags)

    if has_critical:
        # For demo purposes, we still allow manual review of "critical" items 
        # so the insurer can see the spoofing/mismatch and reject it manually.
        action = "MANUAL_REVIEW"
    elif "BEHAVIORAL_ANOMALY_DETECTED" in flags or "NO_GPS_DATA" in flags or len(flags) >= 2:
        action = "MANUAL_REVIEW"
    else:
        action = "AUTO_APPROVE"

    return {
        "passed": action == "AUTO_APPROVE",
        "action": action,
        "flags": flags,
        "fraud_score": fraud_score,
        "ml_signals": ml_features if "demo" in trigger_event_id else None
    }

