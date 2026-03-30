const axios = require("axios");
const { ZONES, THRESHOLDS } = require("../config/zones");

// CPCB AQI API (public, no key needed for basic data)
const CPCB_BASE = "https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69";

// Chennai station IDs
const CHENNAI_STATIONS = {
  "T. Nagar":   "Alandur Bus Depot, Chennai - CPCB",
  "Adyar":      "Manali, Chennai - CPCB",
  "Velachery":  "Velachery - CPCB",
};

function getMockAQI(zone) {
  const base = { "T. Nagar": 145, "Adyar": 130, "Velachery": 155 };
  const baseAQI = base[zone.name] ?? 140;
  const aqi = baseAQI + (Math.random() - 0.5) * 60;
  return {
    zone: zone.name,
    aqi: Math.round(Math.max(0, aqi)),
    category: aqi > 400 ? "Severe" : aqi > 300 ? "Very Poor" : aqi > 200 ? "Poor" : "Moderate",
    mocked: true,
  };
}

async function checkAQIForZone(zone) {
  try {
    // In production: hit CPCB API with proper credentials
    // For now: return mock data
    return getMockAQI(zone);
  } catch (err) {
    console.error(`[AQI] Error fetching ${zone.name}:`, err.message);
    return getMockAQI(zone);
  }
}

async function checkAllZonesAQI() {
  const results = await Promise.all(ZONES.map(checkAQIForZone));
  const severeAQI = results.filter(r => r.aqi >= THRESHOLDS.SEVERE_AQI.value);
  return { all: results, severe: severeAQI };
}

module.exports = { checkAllZonesAQI };
