// All zones GigShield monitors in real time
const ZONES = [
  { name: "T. Nagar",       lat: 13.0344, lon: 80.2337, floodRisk: "HIGH"   },
  { name: "Adyar",          lat: 13.0067, lon: 80.2561, floodRisk: "HIGH"   },
  { name: "Velachery",      lat: 12.9780, lon: 80.2209, floodRisk: "HIGH"   },
  { name: "Porur",          lat: 13.0343, lon: 80.1583, floodRisk: "MEDIUM" },
  { name: "Anna Nagar",     lat: 13.0850, lon: 80.2101, floodRisk: "LOW"    },
  { name: "Sholinganallur", lat: 12.9010, lon: 80.2279, floodRisk: "LOW"    },
  { name: "Tambaram",       lat: 12.9249, lon: 80.1000, floodRisk: "MEDIUM" },
  { name: "Perambur",       lat: 13.1143, lon: 80.2329, floodRisk: "LOW"    },
  { name: "Mylapore",       lat: 13.0368, lon: 80.2676, floodRisk: "MEDIUM" },
  { name: "Guindy",         lat: 13.0067, lon: 80.2206, floodRisk: "MEDIUM" },
];

// Trigger thresholds
const THRESHOLDS = {
  HEAVY_RAIN:    { field: "rain_mm",    value: 64.0,  unit: "mm/hr"  },
  FLOOD:         { field: "rain_mm",    value: 115.0, unit: "mm/6hr" },
  SEVERE_AQI:    { field: "aqi",        value: 400,   unit: "AQI"    },
  PLATFORM_PAUSE:{ field: "status",     value: "PAUSED", unit: ""   },
  CURFEW:        { field: "curfew",     value: true,  unit: ""       },
};

module.exports = { ZONES, THRESHOLDS };
