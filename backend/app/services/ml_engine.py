import os
import joblib
import pandas as pd
import numpy as np
from pathlib import Path

# Paths
ML_DIR = Path(__file__).parent.parent / "ml" / "models"
PREMIUM_MODEL_PATH = ML_DIR / "xgboost_premium_model.pkl"
FRAUD_MODEL_PATH = ML_DIR / "isolation_forest_fraud.pkl"
SCALER_PATH = ML_DIR / "feature_scaler.pkl"
FRAUD_FEATS_PATH = ML_DIR / "fraud_feature_list.pkl"

class MLEngine:
    def __init__(self):
        self.premium_model = None
        self.fraud_model = None
        self.scaler = None
        self.fraud_features = None
        self.load_models()

    def load_models(self):
        try:
            if PREMIUM_MODEL_PATH.exists():
                self.premium_model = joblib.load(PREMIUM_MODEL_PATH)
            if FRAUD_MODEL_PATH.exists():
                self.fraud_model = joblib.load(FRAUD_MODEL_PATH)
            if SCALER_PATH.exists():
                self.scaler = joblib.load(SCALER_PATH)
            if FRAUD_FEATS_PATH.exists():
                self.fraud_features = joblib.load(FRAUD_FEATS_PATH)
            print("✅ [MLEngine] Production models loaded successfully")
        except Exception as e:
            print(f"❌ [MLEngine] Model load failed: {str(e)}")

    def predict_premium(self, rider_data: dict) -> float:
        """
        Predicts the ideal weekly premium for a rider.
        Default features if missing: zone_flood_score, avg_weekly_aqi, disruption_freq_90d, etc.
        """
        if not self.premium_model:
            return 49.0  # Fallback
        
        # Mapping rider data to model features
        # Assuming features: [zone_flood_score, avg_weekly_aqi, disruption_freq_90d, avg_daily_hours, avg_daily_earnings, avg_rider_rating, red_alert_days, week_of_year, month, disruption_days]
        df = pd.DataFrame([rider_data])
        
        # Ensure all columns exist
        model_feats = [
            "zone_flood_score", "avg_weekly_aqi", "disruption_freq_90d", 
            "avg_daily_hours", "avg_daily_earnings", "avg_rider_rating", 
            "red_alert_days", "week_of_year", "month", "disruption_days"
        ]
        for f in model_feats:
            if f not in df.columns:
                df[f] = 0.0 # Default
        
        try:
            prediction = self.premium_model.predict(df[model_feats])[0]
            return float(max(35.0, min(100.0, prediction)))
        except:
            return 49.0

    def evaluate_fraud(self, claim_data: dict) -> float:
        """
        Scores a claim for behavioral anomalies using Isolation Forest.
        Returns a score between 0 (safe) and 1 (anomaly).
        """
        if not self.fraud_model or not self.scaler or not self.fraud_features:
            return 0.1 # Fallback
        
        df = pd.DataFrame([claim_data])
        for f in self.fraud_features:
            if f not in df.columns:
                df[f] = 0.0
                
        try:
            X_scaled = self.scaler.transform(df[self.fraud_features])
            raw_decision = self.fraud_model.decision_function(X_scaled)[0]
            # Convert decision function to 0-1 score (heuristic)
            # IsolationForest decision_function: negative is anomaly
            score = max(0, min(1, 0.5 - raw_decision * 0.5))
            return float(score)
        except:
            return 0.1

# Singleton instance
ml_engine = MLEngine()
