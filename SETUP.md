# GigShield — Complete Setup & Deployment Guide

## Project Structure
```
gigshield/
├── backend/          → FastAPI (Python) — deploy to Railway
├── trigger-service/  → Node.js cron — deploy to Railway
├── frontend/         → Next.js PWA — deploy to Vercel
```

---

## Step 1 — Prerequisites (install these first)

```bash
# Install Node.js (if not installed)
# Download from: https://nodejs.org/en/download (LTS version)

# Verify installs
python --version     # should be 3.10+
node --version       # should be 18+
npm --version
git --version
```

---

## Step 2 — Clone & setup locally

```bash
# Create the project (or clone from GitHub)
cd gigshield

# Backend setup
cd backend
pip install -r requirements.txt

# Train ML model (optional but recommended)
cd ..
python backend/ml/train_model.py

# Trigger service setup
cd trigger-service
npm install

# Frontend setup
cd ../frontend
npm install
```

---

## Step 3 — Environment variables

Copy `.env.example` to `.env` in each folder and fill in:

**backend/.env**
```
DATABASE_URL=postgresql://...   ← from Railway
REDIS_URL=redis://...           ← from Railway
SECRET_KEY=any-random-string-32-chars
OPENWEATHER_API_KEY=your_key
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
FRONTEND_URL=https://your-app.vercel.app
ENVIRONMENT=production
```

**trigger-service/.env**
```
OPENWEATHER_API_KEY=your_key
REDIS_URL=redis://...           ← same as backend
BACKEND_URL=https://your-api.up.railway.app
PORT=3001
POLL_INTERVAL_MINUTES=15
```

**frontend/.env.local**
```
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
```

---

## Step 4 — Run locally

```bash
# Terminal 1: Backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2: Trigger service
cd trigger-service
npm run dev

# Terminal 3: Frontend
cd frontend
npm run dev
```

Open:
- Rider PWA → http://localhost:3000
- API docs  → http://localhost:8000/docs
- Triggers  → http://localhost:3001/status

---

## Step 5 — Seed demo data

```bash
cd gigshield
python backend/seed.py
```

This creates 12 demo riders with active policies and historical claims.

**Demo login:** any phone number + OTP `123456`

---

## Step 6 — Deploy to Railway (Backend + Trigger)

1. Go to https://railway.app → New Project
2. **Add PostgreSQL** plugin → copy `DATABASE_URL`
3. **Add Redis** plugin → copy `REDIS_URL`

**Deploy Backend:**
```bash
cd backend
git init && git add . && git commit -m "init"
railway login
railway link    # link to your project
railway up
```
Add all env variables in Railway dashboard → Variables tab.

**Deploy Trigger Service:**
```bash
cd trigger-service
railway service create gigshield-triggers
railway up
```
Add `OPENWEATHER_API_KEY`, `REDIS_URL`, `BACKEND_URL` variables.

After deploy, run seed:
```bash
railway run python backend/seed.py
```

---

## Step 7 — Deploy to Vercel (Frontend)

```bash
cd frontend
npm install -g vercel
vercel login
vercel --prod
```

Set environment variable in Vercel dashboard:
```
NEXT_PUBLIC_API_URL = https://your-backend.up.railway.app
```

---

## Step 8 — Test the full flow

1. Open the Vercel URL on your phone
2. Login with any number + OTP `123456`
3. Complete onboarding → activate policy
4. Go to **Policy** tab → click **Simulate heavy rain**
5. Go to **Claims** tab → see auto-generated claim with payout
6. Open `/insurer/dashboard` on desktop → see live analytics

---

## API Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/send-otp` | Send OTP to phone |
| POST | `/auth/verify-otp` | Verify OTP → JWT token |
| GET | `/riders/me` | Get rider profile |
| POST | `/riders/profile` | Update profile |
| GET | `/policy/quote` | Get premium quote |
| POST | `/policy/create` | Activate policy |
| GET | `/claims/my` | Get rider's claims |
| POST | `/claims/simulate-trigger` | Fire demo trigger |
| GET | `/analytics/insurer` | Insurer dashboard data |
| GET | `/analytics/live` | Real-time stats |

Full docs: `https://your-api.up.railway.app/docs`

---

## Demo script (for video recording)

1. **Open PWA** → "When the rain stops deliveries, we start payouts"
2. **Login** → 9876500001 → OTP 123456
3. **Onboarding** → ZOMATO → T. Nagar → 8hrs → ₹800 → Get quote
4. **Show risk score** → 64/100 → ₹55/week → Activate
5. **Dashboard** → show active policy + stats
6. **Policy tab** → Simulate heavy rain → show result
7. **Claims tab** → show auto-generated claim + PAID status
8. **Insurer dashboard** → `/insurer/dashboard` → show live analytics

Total demo time: ~4 minutes
