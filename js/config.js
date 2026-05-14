const CONFIG = {
  // Map defaults — Cape Town harbour as centre point
  map: {
    center: [-33.9249, 18.4241],
    zoom: 11,
    maxZoom: 18,
  },

  // Tide data source — no API key needed
  // Uses tide-forecast.com scraping (same source as daily report)
  tideSource: 'tide-forecast',  // 'tide-forecast' | 'open-meteo'

  // Open-Meteo Marine API (free, no key)
  marineApi: 'https://marine-api.open-meteo.com/v1/marine',

  // Chart display
  routeColor: '#22c55e',
  waypointLinkColor: '#4b0082', // Dark purple
  routeWeight: 4,
  waypointColor: '#3b82f6',
  dangerSwellMeters: 3.0,  // Waves above this trigger warnings
  planningSpeedKnots: 6.0, // Default vessel planning speed
};