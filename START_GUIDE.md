# 🚀 GigShield — How to Run (4 Terminals)

---

## Terminal 1 — Backend API
**Folder:** `gigshield/backend`
```
uvicorn main:app --reload --port 8001
```
✅ Swagger docs: http://localhost:8001/docs

---

## Terminal 2 — Rider App (GigShield B2C)
**Folder:** `gigshield/frontend`
```
npm run dev
```
✅ Opens at: http://localhost:3000

---

## Terminal 3 — Trigger Service (Weather + AQI Engine)
**Folder:** `gigshield/trigger-service`
```
npm run dev
```
✅ Runs at: http://localhost:3001

---

## Terminal 4 — Insurer Portal (B2B Dashboard) - https://github.com/cbrethick/gigshield-insurer-portal.git
**Folder:** `gigshield-insurer-portal/frontend`
```
npm run dev
```
✅ Opens at: http://localhost:3002

---

## ⚠️ Checklist Before Starting
- PostgreSQL running with database `gigshield` created
- Redis running on localhost:6379
- Python packages installed: `pip install -r requirements.txt` (in `gigshield/backend`)
- Node packages installed: `npm install` in each of the 3 Node folders above

## ❌ Do NOT run anything in these folders (not needed):
- `gigshield-insurer-portal/backend` — Use `gigshield/backend` instead
- `gigshield-insurer-portal/trigger-service` — Use `gigshield/trigger-service` instead
