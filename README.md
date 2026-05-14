# ⛵ Sailing Route Planner

Open-source sailing route planner with **Leaflet map**, **tide data overlays**, and **marine weather integration**.

Built for sailors who want to plan routes with real-time tidal conditions, not just straight lines on a chart.

## Features

- **Interactive Leaflet map** — Click to set waypoints, straight-line routing
- **Tide data overlay** — High/low tide visualisation along route
- **Marine weather** — Wave height, swell, wind data from Open-Meteo (free, no API key)
- **Warning system** — Alerts when swell exceeds safe thresholds
- **Responsive** — Works on phone, tablet, or desktop

## Quick Start

### Option 1: Live Server (local dev)
```bash
npm install
npm start
# Opens at http://localhost:8080
```

### Option 2: Open directly
Just open `index.html` in your browser. All dependencies are loaded via CDN.

### Option 3: GitHub Pages
```bash
npm run deploy
```

## Architecture

```
┌─────────────────────────────────────────┐
│  index.html         ← Entry point       │
├─────────────────────────────────────────┤
│  js/                                    │
│    config.js     ← API URLs, thresholds │
│    tides.js      ← Tide fetch + render  │
│    app.js        ← Map init, routing, UI│
├─────────────────────────────────────────┤
│  css/                                   │
│    style.css     ← Dark nautical theme   │
└─────────────────────────────────────────┘
```

## Data Sources

| Source | Type | Auth | Coverage |
|--------|------|------|----------|
| OpenStreetMap | Basemap tiles | Free/None | Global |
| Custom Direct Router | Route calculation | Free | Global |
| Open-Meteo Marine | Wave/swell/wind | Free | Global |
| NOAA CO-OPS | Tide predictions | Free | US only |
| tide-forecast.com | Tide predictions | N/A | Global (needs proxy) |

## Tide Data — Setup Notes

Open-Meteo provides **free** marine weather (wave height, swell, wind) — no API key required.

For **global tide predictions**, you'll need a server-side proxy because:
- `tide-forecast.com` blocks CORS requests
- NOAA only covers US stations

### Quick proxy option (Vercel/Netlify):
```javascript
// api/tides.js — serverless function
export default async function handler(req, res) {
  const { lat, lon } = req.query;
  // Scrape tide-forecast.com or use Open-Meteo
  // Return [{ time, height, type }]
}
```

## Planned Features

- [ ] Tide polygon overlay (colour-coded safe/caution/danger zones)
- [ ] Multi-day tide forecast for route timing
- [ ] Wind barbs overlay on map
- [ ] Save/load routes from localStorage
- [ ] Export GPX/KML for chartplotters
- [ ] Current/wind rose widget

## Contributing

This is a personal project. PRs welcome if useful.

---
*Made by a sailor who finally wants to know when it's safe to leave the harbour.* 🧭