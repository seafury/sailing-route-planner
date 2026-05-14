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
        name: "Cape Town Port Limits",
        description: "Official boundary of the Port of Cape Town.",
        style: { color: "#3b82f6", weight: 2, fillOpacity: 0.1 }
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [18.401, -33.901], // Green Point
          [18.368, -33.815], // Robben Island
          [18.484, -33.896], // Diep River Mouth
          [18.401, -33.901]
        ]]
      }
    },
    {
      type: "Feature",
      properties: {
        name: "Pilot Boarding Station",
        description: "Compulsory pilotage boarding point (VHF Ch 14).",
        icon: "⚓"
      },
      geometry: {
        type: "Point",
        coordinates: [18.4, -33.9]
      }
    },
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
    },
    {
      type: "Feature",
      properties: {
        name: "Robben Island Exclusion Zone",
        description: "1nm mandatory exclusion zone around the island.",
        style: { color: "#ef4444", weight: 1, fillOpacity: 0.2 }
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [18.348, -33.835],
          [18.388, -33.835],
          [18.388, -33.795],
          [18.348, -33.795],
          [18.348, -33.835]
        ]]
      }
    }
  ]
};