"""
Train Isolation Forest model for Fraud Detection.
Detects anomalies in rider mobility fingerprints.
"""
import numpy as np
import pandas as pd
import pickle
import os
from sklearn.ensemble import IsolationForest

# ── Generate Synthetic Behavioral Data ──
np.random.seed(42)
N_NORMAL = 5000
N_FRAUD  = 150

# Normal Rider Behavior
def generate_normal_data(n):
    data = []
    for _ in range(n):
        # Lat/Lng variance (staying within zone)
        loc_variance = np.random.exponential(0.02) 
        # Avg speed between pings (10-40 km/h)
        avg_speed = np.random.normal(25, 8)
        # Ping consistency (time between pings in seconds)
        ping_interval_std = np.random.normal(60, 20)
        # Past claim rate (claims per week)
        claim_rate = np.random.poisson(0.5)
        
        data.append([loc_variance, avg_speed, ping_interval_std, claim_rate])
    return np.array(data)

# AnomalousBehavior (Spoofing/Fraud)
def generate_fraud_data(n):
    data = []
    for _ in range(n):
        # High variance or zero variance (fixed point spoofing)
        loc_variance = np.random.choice([np.random.uniform(0.5, 2.0), 0.000001])
        # Impossible speeds (>100 km/h or fixed 0)
        avg_speed = np.random.choice([np.random.uniform(120, 250), 0.1])
        # Highly irregular pings
        ping_interval_std = np.random.uniform(500, 2000)
        # Frequent claims
        claim_rate = np.random.poisson(5)
        
        data.append([loc_variance, avg_speed, ping_interval_std, claim_rate])
    return np.array(data)

normal_behavior = generate_normal_data(N_NORMAL)
fraud_behavior  = generate_fraud_data(N_FRAUD)

X = np.vstack([normal_behavior, fraud_behavior])
# In Isolation Forest: 1 = normal, -1 = anomaly
y = np.array([1]*N_NORMAL + [-1]*N_FRAUD)

print(f"Training on {len(X)} samples ({N_FRAUD} anomalies)...")

# ── Train Isolation Forest ──
model = IsolationForest(
    n_estimators=100,
    contamination=0.03, # expect ~3% anomalies
    random_state=42
)
model.fit(X)

# ── Save Model ──
os.makedirs('backend/ml/models', exist_ok=True)
with open('backend/ml/models/fraud_isolation_forest.pkl', 'wb') as f:
    pickle.dump(model, f)

print("Isolation Forest model saved to backend/ml/models/fraud_isolation_forest.pkl")

# Test prediction
test_normal = np.array([[0.01, 20, 50, 0]])
test_fraud  = np.array([[1.5, 180, 1500, 8]])

print(f"Test Normal Prediction (1 is normal): {model.predict(test_normal)[0]}")
print(f"Test Fraud Prediction (-1 is anomaly): {model.predict(test_fraud)[0]}")
