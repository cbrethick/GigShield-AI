const axios = require("axios");
const { ZONES } = require("../config/zones");

const API_KEY = process.env.GNEWS_API_KEY;
const BASE_URL = "https://gnews.io/api/v4/search";

// Keywords to search for in real-time news
const SEARCH_KEYWORDS = '(curfew OR restriction OR "section 144")';

async function checkAllZonesCurfew() {
  if (!API_KEY || API_KEY === "your_gnews_key_here") {
    // Fallback to minimal random mock for demo if no key
    const results = ZONES.map(zone => ({
      zone: zone.name,
      curfew: Math.random() > 0.98, 
      mocked: true
    }));
    return { all: results, active: results.filter(r => r.curfew) };
  }

  try {
    // Search for curfew/restrictions in Chennai
    const res = await axios.get(BASE_URL, {
      params: {
        q: `${SEARCH_KEYWORDS} AND Chennai`,
        apikey: API_KEY,
        lang: "en",
        country: "in",
        max: 5, // Check top 5 recent articles
      },
      timeout: 8000
    });

    const articles = res.data.articles || [];
    const hasCurfewNews = articles.length > 0;
    
    // Log findings for debugging
    if (hasCurfewNews) {
      console.log(`[Curfew] Found ${articles.length} relevant news items for Chennai.`);
      articles.forEach(a => console.log(` - ${a.title}`));
    }

    // Currently, we apply the curfew to all Chennai zones if a general Chennai alert is found
    // A more advanced version could parse specific area names from the article text
    const results = ZONES.map(zone => {
      // Logic: If there's a general Chennai curfew news, it likely affects all zones
      // You can refine this by searching for zone.name in article titles/description
      const areaSpecificAlert = articles.some(a => 
        a.title.toLowerCase().includes(zone.name.toLowerCase()) || 
        a.description.toLowerCase().includes(zone.name.toLowerCase())
      );

      return {
        zone: zone.name,
        curfew: hasCurfewNews && areaSpecificAlert,
        source: hasCurfewNews ? articles[0].source.name : null,
        url: hasCurfewNews ? articles[0].url : null,
        mocked: false
      };
    });

    // Special case: if there's a general alert but no area-specific match, 
    // we might still want to trigger for high-traffic zones like T. Nagar/Adyar
    const active = results.filter(r => r.curfew);
    
    return {
      all: results,
      active: active,
      articles: articles
    };
  } catch (err) {
    console.error(`[Curfew] Error fetching news:`, err.message);
    return {
      all: ZONES.map(z => ({ zone: z.name, curfew: false, mocked: true })),
      active: []
    };
  }
}

module.exports = { checkAllZonesCurfew };
