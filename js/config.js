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

const CAPE_TOWN_MARITIME = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "VTS Reporting Point (4nm)",
        description: "Report to Port Control (VHF Ch 14) when 4nm off limits.",
        style: { color: "#f59e0b", weight: 2, dashArray: "5, 5" }
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [18.32, -33.78], [18.28, -33.85], [18.35, -33.95]
        ]
      }
    }
  ]
};