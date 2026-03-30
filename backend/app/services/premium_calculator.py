import numpy as np
import pandas as pd
import os
import pickle
from typing import Dict

MODEL_PATH = os.path.join(os.path.dirname(__file__), "../../ml/models/premium_model.pkl")

# Zone risk data - pre-computed from IMD historical data
ZONE_RISK_DATA = {
    "T. Nagar":       {"flood_score": 0.72, "avg_aqi": 145, "disruption_90d": 18},
    "Adyar":          {"flood_score": 0.78, "avg_aqi": 130, "disruption_90d": 20},
    "Velachery":      {"flood_score": 0.65, "avg_aqi": 155, "disruption_90d": 15},
    "Porur":          {"flood_score": 0.45, "avg_aqi": 160, "disruption_90d": 10},
    "Anna Nagar":     {"flood_score": 0.30, "avg_aqi": 120, "disruption_90d": 7},
    "Sholinganallur": {"flood_score": 0.20, "avg_aqi": 140, "disruption_90d": 5},
    "Tambaram":       {"flood_score": 0.55, "avg_aqi": 165, "disruption_90d": 12},
    "Perambur":       {"flood_score": 0.40, "avg_aqi": 175, "disruption_90d": 9},
    "Mylapore":       {"flood_score": 0.60, "avg_aqi": 135, "disruption_90d": 14},
    "Guindy":         {"flood_score": 0.50, "avg_aqi": 158, "disruption_90d": 11},
}

DEFAULT_ZONE_RISK = {"flood_score": 0.50, "avg_aqi": 150, "disruption_90d": 10}

def get_zone_risk(zone: str) -> dict:
    for key in ZONE_RISK_DATA:
        if key.lower() in zone.lower() or zone.lower() in key.lower():
            return ZONE_RISK_DATA[key]
    return DEFAULT_ZONE_RISK

def calculate_risk_score(
    flood_score: float,
    avg_aqi: float,
    disruption_90d: int,
    avg_daily_hours: float,
) -> float:
    """Risk score 0-100. Higher = more risky = higher premium."""
    flood_component    = flood_score * 40          # max 40
    aqi_component      = min(avg_aqi / 500, 1) * 25  # max 25
    disruption_comp    = min(disruption_90d / 30, 1) * 25  # max 25
    hours_component    = min(avg_daily_hours / 12, 1) * 10  # max 10
    return round(flood_component + aqi_component + disruption_comp + hours_component, 1)

def calculate_weekly_premium(
    zone: str,
    avg_daily_hours: float,
    avg_daily_earnings: float,
) -> Dict:
    zone_risk = get_zone_risk(zone)
    flood_score    = zone_risk["flood_score"]
    avg_aqi        = zone_risk["avg_aqi"]
    disruption_90d = zone_risk["disruption_90d"]

    risk_score = calculate_risk_score(flood_score, avg_aqi, disruption_90d, avg_daily_hours)

    # Try ML model first
    try:
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        features = np.array([[
            flood_score,
            avg_aqi / 500,
            disruption_90d / 30,
            avg_daily_hours / 12,
            avg_daily_earnings / 1500
        ]])
        premium = float(model.predict(features)[0])
    except Exception:
        # Rule-based fallback (always works)
        base = 50.0
        risk_mult     = 1 + (flood_score * 0.5) + (avg_aqi / 2000) + (disruption_90d / 80)
        coverage_mult = (avg_daily_hours / 8) * (avg_daily_earnings / 800)
        premium = base * risk_mult * coverage_mult

    # Apply hyper-local zone discount
    discount = {
        'Sholinganallur': 10, 'Anna Nagar': 8, 'Porur': 6,
        'Perambur': 4, 'Tambaram': 2, 'Guindy': 2
    }.get(zone, 0)
    
    premium = round(max(35, min(150, premium - discount)), 0)
    hourly_rate = avg_daily_earnings / max(avg_daily_hours, 1)
    max_payout  = round(min(avg_daily_hours * hourly_rate * 1.5, avg_daily_earnings * 2), 0)
    coverage_hours = min(avg_daily_hours, 8.0)

    return {
        "risk_score": risk_score,
        "weekly_premium_inr": premium,
        "max_payout_inr": max_payout,
        "coverage_hours_per_event": coverage_hours,
        "hourly_rate": round(hourly_rate, 2),
        "zone_flood_score": flood_score,
        "zone_avg_aqi": avg_aqi,
        "zone_disruption_90d": disruption_90d,
    }
