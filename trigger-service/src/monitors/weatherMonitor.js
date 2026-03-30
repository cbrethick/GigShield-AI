const axios = require("axios");
const { ZONES, THRESHOLDS } = require("../config/zones");

const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

// Mock data for when API key is missing or in demo mode
function getMockWeather(zone) {
  const mockRain = {
    "T. Nagar":   Math.random() > 0.7 ? 70 + Math.random() * 40 : Math.random() * 30,
    "Adyar":      Math.random() > 0.7 ? 68 + Math.random() * 35 : Math.random() * 25,
    "Velachery":  Math.random() > 0.75 ? 65 + Math.random() * 30 : Math.random() * 20,
  };
  return {
    zone: zone.name,
    rain_mm: mockRain[zone.name] ?? Math.random() * 40,
    temperature: 28 + Math.random() * 8,
    humidity: 70 + Math.random() * 20,
    description: "scattered clouds",
    mocked: true,
  };
}

async function fetchWeatherForZone(zone) {
  if (!API_KEY || API_KEY === "your_openweathermap_key_here") {
    return getMockWeather(zone);
  }
  try {
    const res = await axios.get(BASE_URL, {
      params: { lat: zone.lat, lon: zone.lon, appid: API_KEY, units: "metric" },
      timeout: 8000,
    });
    const data = res.data;
    return {
      zone: zone.name,
      rain_mm: data.rain?.["1h"] ?? data.rain?.["3h"] ?? 0,
      temperature: data.main?.temp ?? 0,
      humidity: data.main?.humidity ?? 0,
      description: data.weather?.[0]?.description ?? "",
      mocked: false,
    };
  } catch (err) {
    console.error(`[Weather] Error fetching ${zone.name}:`, err.message);
    return getMockWeather(zone);
  }
}

async function checkAllZones() {
  const results = await Promise.all(ZONES.map(fetchWeatherForZone));
  const triggered = results.filter(r => r.rain_mm >= THRESHOLDS.HEAVY_RAIN.value);
  const floodTriggered = results.filter(r => r.rain_mm >= THRESHOLDS.FLOOD.value);

  return {
    all: results,
    heavyRain: triggered,
    flood: floodTriggered,
  };
}

module.exports = { checkAllZones, fetchWeatherForZone };
