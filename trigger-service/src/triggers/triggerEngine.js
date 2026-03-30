const axios = require("axios");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

async function fireTrigger({ zone, triggerType, triggerValue, threshold, platformStatus, durationHours }) {
  try {
    const res = await axios.post(
      `${BACKEND_URL}/claims/simulate-trigger`,
      {
        zone,
        trigger_type: triggerType,
        trigger_value: triggerValue,
        threshold,
        platform_status: platformStatus,
        duration_hours: durationHours,
      },
      { timeout: 30000 }
    );
    console.log(`[Trigger] FIRED ${triggerType} for ${zone}:`, res.data?.result ?? res.data);
    return res.data;
  } catch (err) {
    console.error(`[Trigger] Failed to fire ${triggerType} for ${zone}:`, err.message);
    return null;
  }
}

async function evaluateAndFire(weatherResults, aqiResults, platformResults, curfewResults) {
  const fired = [];

  for (const weather of weatherResults) {
    const platform = platformResults.find(p => p.zone === weather.zone);
    const platformPaused = platform?.status === "PAUSED";

    // HEAVY RAIN: rainfall >= 64mm AND platform paused
    if (weather.rain_mm >= 64 && platformPaused) {
      console.log(`[Trigger] HEAVY_RAIN detected: ${weather.zone} | ${weather.rain_mm.toFixed(1)}mm`);
      const result = await fireTrigger({
        zone: weather.zone,
        triggerType: "HEAVY_RAIN",
        triggerValue: weather.rain_mm,
        threshold: 64,
        platformStatus: "PAUSED",
        durationHours: estimateDuration(weather.rain_mm),
      });
      if (result) fired.push({ zone: weather.zone, type: "HEAVY_RAIN", result });
    }

    // FLOOD: rainfall >= 115mm
    if (weather.rain_mm >= 115 && platformPaused) {
      console.log(`[Trigger] FLOOD detected: ${weather.zone} | ${weather.rain_mm.toFixed(1)}mm`);
      const result = await fireTrigger({
        zone: weather.zone,
        triggerType: "FLOOD",
        triggerValue: weather.rain_mm,
        threshold: 115,
        platformStatus: "PAUSED",
        durationHours: estimateDuration(weather.rain_mm),
      });
      if (result) fired.push({ zone: weather.zone, type: "FLOOD", result });
    }
  }

  // CURFEW: curfew active
  for (const curfew of curfewResults) {
    if (curfew.curfew) {
      console.log(`[Trigger] CURFEW detected: ${curfew.zone}`);
      const result = await fireTrigger({
        zone: curfew.zone,
        triggerType: "CURFEW",
        triggerValue: 1.0,
        threshold: 1.0,
        platformStatus: "PAUSED",
        durationHours: 12,
      });
      if (result) fired.push({ zone: curfew.zone, type: "CURFEW", result });
    }
  }

  // SEVERE AQI: AQI >= 400
  for (const aqi of aqiResults) {
    if (aqi.aqi >= 400) {
      console.log(`[Trigger] SEVERE_AQI detected: ${aqi.zone} | AQI ${aqi.aqi}`);
      const result = await fireTrigger({
        zone: aqi.zone,
        triggerType: "SEVERE_AQI",
        triggerValue: aqi.aqi,
        threshold: 400,
        platformStatus: "ACTIVE",
        durationHours: 3,
      });
      if (result) fired.push({ zone: aqi.zone, type: "SEVERE_AQI", result });
    }
  }

  return fired;
}

function estimateDuration(rain_mm) {
  if (rain_mm >= 150) return 8;
  if (rain_mm >= 115) return 6;
  if (rain_mm >= 90)  return 5;
  if (rain_mm >= 64)  return 4;
  return 3;
}

module.exports = { evaluateAndFire, fireTrigger };
