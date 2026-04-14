const axios = require("axios");
const { ZONES, THRESHOLDS } = require("../config/zones");

const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = "https://api.openweathermap.org/data/2.5/air_pollution";

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

// Map OpenWeather AQI index (1-5) to a comparable 0-500 scale for consistency with existing thresholds
function mapToAQIScale(owAQI) {
  const map = {
    1: 45,   // Good
    2: 95,   // Fair
    3: 180,  // Moderate
    4: 280,  // Poor
    5: 450,  // Very Poor (Severe)
  };
  return map[owAQI] || 100;
}

async function checkAQIForZone(zone) {
  if (!API_KEY || API_KEY === "your_openweathermap_key_here") {
    return getMockAQI(zone);
  }

  try {
    const res = await axios.get(BASE_URL, {
      params: { lat: zone.lat, lon: zone.lon, appid: API_KEY },
      timeout: 8000,
    });
    
    const owAQI = res.data.list[0]?.main?.aqi ?? 3;
    const mappedAQI = mapToAQIScale(owAQI);

    return {
      zone: zone.name,
      aqi: mappedAQI,
      raw_index: owAQI,
      category: owAQI === 5 ? "Severe" : owAQI === 4 ? "Very Poor" : owAQI === 3 ? "Poor" : "Moderate",
      mocked: false,
    };
  } catch (err) {
    console.error(`[AQI] Error fetching ${zone.name}:`, err.message);
    return getMockAQI(zone);
  }
}

async function checkAllZonesAQI() {
  const results = await Promise.all(ZONES.map(checkAQIForZone));
  // Severe trigger if mapped AQI >= 400 (or raw index == 5)
  const severeAQI = results.filter(r => r.aqi >= THRESHOLDS.SEVERE_AQI.value);
  return { all: results, severe: severeAQI };
}

module.exports = { checkAllZonesAQI };
