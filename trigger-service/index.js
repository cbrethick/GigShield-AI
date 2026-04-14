require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { checkAllZones } = require("./src/monitors/weatherMonitor");
const { checkAllZonesAQI } = require("./src/monitors/aqiMonitor");
const { checkAllZonesPlatform, simulatePause, simulateResume } = require("./src/monitors/platformMonitor");
const { evaluateAndFire, fireTrigger } = require("./src/triggers/triggerEngine");
const { checkAllZonesCurfew } = require("./src/monitors/curfewMonitor");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const POLL_MINUTES = parseInt(process.env.POLL_INTERVAL_MINUTES || "15");

let lastPollResult = null;
let isRunning = false;

// ── Core polling loop ──
async function runPollCycle() {
  if (isRunning) return;
  isRunning = true;
  const startTime = Date.now();

  try {
    console.log(`\n[Poll] Starting cycle at ${new Date().toISOString()}`);

    const [weatherData, aqiData, curfewData] = await Promise.all([
      checkAllZones(),
      checkAllZonesAQI(),
      checkAllZonesCurfew(),
    ]);

    const platformData = checkAllZonesPlatform(weatherData.all);

    const fired = await evaluateAndFire(
      weatherData.all,
      aqiData.all,
      platformData,
      curfewData.all
    );

    lastPollResult = {
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      weather_zones: weatherData.all.length,
      heavy_rain_zones: weatherData.heavyRain.length,
      severe_aqi_zones: aqiData.severe.length,
      active_curfews: curfewData.active.length,
      triggers_fired: fired.length,
      details: {
        weather: weatherData.all,
        aqi: aqiData.all,
        curfew: curfewData.all,
        platform: platformData,
        fired,
      },
    };

    console.log(`[Poll] Done in ${Date.now() - startTime}ms | Triggers fired: ${fired.length}`);
  } catch (err) {
    console.error("[Poll] Error in cycle:", err.message);
  } finally {
    isRunning = false;
  }
}

// ── Cron: every N minutes ──
const cronExpr = `*/${POLL_MINUTES} * * * *`;
cron.schedule(cronExpr, runPollCycle);
console.log(`[GigShield Trigger Service] Polling every ${POLL_MINUTES} minutes`);

// Run once immediately on startup
setTimeout(runPollCycle, 3000);

// ── Express API ──

app.get("/", (req, res) => {
  res.json({ service: "GigShield Trigger Service", status: "running", version: "1.0.0" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", last_poll: lastPollResult?.timestamp ?? null });
});

app.get("/status", (req, res) => {
  res.json(lastPollResult ?? { message: "No poll completed yet" });
});

// Manual trigger for demo
app.post("/trigger/manual", async (req, res) => {
  const { zone, trigger_type, trigger_value, threshold, duration_hours } = req.body;
  if (!zone || !trigger_type) {
    return res.status(400).json({ error: "zone and trigger_type required" });
  }
  try {
    const result = await fireTrigger({
      zone,
      triggerType: trigger_type,
      triggerValue: trigger_value ?? 78.5,
      threshold: threshold ?? 64,
      platformStatus: "PAUSED",
      durationHours: duration_hours ?? 4,
    });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alias for insurer-portal
app.post("/simulate", async (req, res) => {
  const { zone, trigger_type } = req.body;
  try {
    const result = await fireTrigger({
      zone: zone || "T. Nagar",
      triggerType: trigger_type || "HEAVY_RAIN",
      triggerValue: 78.5,
      threshold: 64,
      platformStatus: "PAUSED",
      durationHours: 4,
    });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Platform override for demo
app.post("/platform/pause", (req, res) => {
  const { zone } = req.body;
  simulatePause(zone);
  res.json({ zone, status: "PAUSED" });
});

app.post("/platform/resume", (req, res) => {
  const { zone } = req.body;
  simulateResume(zone);
  res.json({ zone, status: "ACTIVE" });
});

// Forced poll
app.post("/poll/run", async (req, res) => {
  runPollCycle();
  res.json({ message: "Poll cycle started" });
});

app.listen(PORT, () => {
  console.log(`[GigShield Trigger Service] Running on port ${PORT}`);
});
