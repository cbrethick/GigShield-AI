"""
Run this once to train the XGBoost premium model.
python backend/ml/train_model.py
"""
import numpy as np
import pandas as pd
import pickle
import os

# ── Synthetic data generation ──
np.random.seed(42)
N = 5000

zone_profiles = [
    (0.72, 145, 18),  # T. Nagar  - high risk
    (0.78, 130, 20),  # Adyar     - high risk
    (0.65, 155, 15),  # Velachery - high risk
    (0.45, 160, 10),  # Porur     - medium
    (0.30, 120,  7),  # Anna Nagar - low
    (0.20, 140,  5),  # Sholinganallur - low
    (0.55, 165, 12),  # Tambaram  - medium
    (0.40, 175,  9),  # Perambur  - low-medium
    (0.60, 135, 14),  # Mylapore  - medium-high
    (0.50, 158, 11),  # Guindy    - medium
]

rows = []
for _ in range(N):
    profile = zone_profiles[np.random.randint(len(zone_profiles))]
    flood_score    = profile[0] + np.random.normal(0, 0.05)
    avg_aqi        = profile[1] + np.random.normal(0, 15)
    disruption_90d = profile[2] + np.random.randint(-3, 4)
    daily_hours    = np.random.choice([6, 8, 10, 12], p=[0.2, 0.4, 0.3, 0.1])
    daily_earn     = np.random.normal(800, 200)

    flood_score    = np.clip(flood_score, 0, 1)
    avg_aqi        = np.clip(avg_aqi, 50, 500)
    disruption_90d = max(0, disruption_90d)
    daily_earn     = max(400, daily_earn)

    # Premium formula (ground truth with noise)
    base = 50.0
    risk_mult     = 1 + (flood_score * 0.5) + (avg_aqi / 2000) + (disruption_90d / 80)
    coverage_mult = (daily_hours / 8) * (daily_earn / 800)
    premium = base * risk_mult * coverage_mult
    premium = np.clip(premium + np.random.normal(0, 3), 35, 150)

    rows.append({
        'flood_score':    flood_score,
        'aqi_norm':       avg_aqi / 500,
        'disruption_norm':disruption_90d / 30,
        'hours_norm':     daily_hours / 12,
        'earn_norm':      daily_earn / 1500,
        'premium':        round(premium, 2),
    })

df = pd.DataFrame(rows)
print(f"Generated {len(df)} training samples")
print(df.describe())

# ── Train XGBoost ──
try:
    from xgboost import XGBRegressor
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error

    X = df[['flood_score','aqi_norm','disruption_norm','hours_norm','earn_norm']]
    y = df['premium']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = XGBRegressor(
        n_estimators=200, max_depth=4, learning_rate=0.1,
        subsample=0.8, colsample_bytree=0.8, random_state=42,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    print(f"XGBoost MAE: ₹{mae:.2f}")

    os.makedirs('backend/ml/models', exist_ok=True)
    with open('backend/ml/models/premium_model.pkl', 'wb') as f:
        pickle.dump(model, f)
    print("Model saved to backend/ml/models/premium_model.pkl")

except ImportError:
    print("XGBoost not available — rule-based fallback will be used in production")
    print("Install with: pip install xgboost scikit-learn")
