const { ZONES } = require("../config/zones");

// For demo purposes, curfew alert is mocked to randomly fire for a zone
// in production, this would ingest data from state API or news scraping

async function checkAllZonesCurfew() {
  const results = ZONES.map(zone => {
    // 5% chance of curfew active for demo
    const curfewActive = Math.random() > 0.95; 
    return {
      zone: zone.name,
      curfew: curfewActive,
    };
  });

  const activeCurfews = results.filter(r => r.curfew);
  
  return {
    all: results,
    active: activeCurfews,
  };
}

module.exports = { checkAllZonesCurfew };
