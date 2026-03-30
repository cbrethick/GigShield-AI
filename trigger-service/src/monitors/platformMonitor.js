const { ZONES } = require("../config/zones");

// In production: integrate with Zomato/Swiggy partner APIs
// For demo: intelligent mock that correlates with weather data

const zoneStatus = {};
ZONES.forEach(z => { zoneStatus[z.name] = "ACTIVE"; });

function updateZoneStatus(zone, rain_mm) {
  if (rain_mm >= 64) {
    zoneStatus[zone] = "PAUSED";
  } else if (rain_mm < 30) {
    zoneStatus[zone] = "ACTIVE";
  }
}

function getZoneStatus(zone) {
  return {
    zone,
    status: zoneStatus[zone] ?? "ACTIVE",
    reason: zoneStatus[zone] === "PAUSED" ? "heavy_rain" : null,
    mocked: true,
  };
}

function checkAllZonesPlatform(weatherData) {
  // Update statuses based on latest weather
  weatherData.forEach(w => updateZoneStatus(w.zone, w.rain_mm));

  return ZONES.map(z => getZoneStatus(z.name));
}

// Expose manual override for demo API
function simulatePause(zone) {
  zoneStatus[zone] = "PAUSED";
}
function simulateResume(zone) {
  zoneStatus[zone] = "ACTIVE";
}

module.exports = { checkAllZonesPlatform, simulatePause, simulateResume, getZoneStatus };
