# ⛵ Sailing Route Planner — Project Plan

## Vision

A clean, fast, offline-capable web app that lets sailors:
1. **Click waypoints** on a Leaflet map to define a route
2. **See tide data** overlaid on the route (high/low markers, colour-coded safety zones)
3. **Get marine weather** (wave height, swell, wind) from free APIs
4. **Receive warnings** when conditions exceed safe thresholds (e.g., swell > 3m)

No backend required. Everything runs in the browser. Deployable to GitHub Pages for free.

## Scope and Principles

- This document is product and delivery focused (features, architecture, risks, milestones).
- Tooling/editor recommendations live in `README.md`, not in this project plan.
- MVP target: static front-end hosted on GitHub Pages.
- Optional infrastructure (serverless proxy) is allowed only when a third-party data source cannot be consumed client-side due to CORS or licensing constraints.

---

## Architecture

```
sailing-route-planner/
├── index.html              ← Single entry point (SPA)
├── css/
│   └── style.css           ← Dark nautical theme, responsive
├── js/
│   ├── config.js           ← API URLs, thresholds, map defaults
│   ├── tides.js            ← Tide data fetch + sidebar render
│   ├── app.js              ← Map init, routing, UI event handlers
│   └── overlays.js         ← Tide polygons, wind barbs (future)
├── PROJECT_PLAN.md         ← This file
├── README.md               ← Setup + tooling notes
└── package.json            ← Dependencies (leaflet, live-server)
```

**Data flow:**
```
User clicks map → app.js captures latlng → adds waypoint marker
                 ↓ (2+ waypoints)
         OSRM calculates route → draws polyline on map
                 ↓
         Fetch marine data (Open-Meteo) → display swell/wind in sidebar
                 ↓
         Fetch tide predictions → render table + colour-code route segments
```

## Constraints and Assumptions

- **Hosting model:** Static-first. Primary deployment is GitHub Pages.
- **Optional proxy:** If a required provider blocks browser access (CORS/rate limits/auth), use a minimal serverless proxy (Cloudflare Worker/Vercel Function) with read-only pass-through and no user data storage.
- **Data licensing:** Every external source must be validated for usage rights before implementation.
- **Offline behavior:** App shell (HTML/CSS/JS + recent routes) should work offline. Live weather/tide fetches require connectivity. Basemap tiles are best-effort cache and subject to tile provider ToS.
- **Safety disclaimer:** Forecast overlays are decision-support only, not a substitute for official marine forecasts, charts, or seamanship.

---

## MVP Definition (Strict)

The MVP is complete only when all items below are done. Anything not listed here is post-MVP.

### 1) Core Routing and UI (`js/app.js`, `index.html`, `css/style.css`) ✅ mostly done
- [x] Place waypoints via map click
- [x] Build route polyline from 2+ waypoints using OSRM
- [x] Show route details in sidebar (distance/basic route info)
- [x] Provide core controls (Start/End/Route/Clear/Tides)
- [ ] Ensure clear error states for failed route requests and empty waypoint sets

### 2) Live Marine Conditions (`js/app.js`, `js/config.js`) ✅ mostly done
- [x] Fetch marine weather from Open-Meteo
- [x] Show at least swell + wind values in sidebar
- [ ] Add timestamp + source attribution for weather data
- [ ] Handle fetch failure with non-blocking UI banner and stale-data indicator

### 3) Tide Data and Risk Output (`js/tides.js`, `js/config.js`, `js/app.js`) 🔲
- [ ] Finalize one primary South Africa-capable tide provider (licensed + browser-accessible)
- [ ] Add one fallback provider and normalize both to a shared tide schema
- [ ] Render tide table with station name, timestamps, and source label
- [ ] Add optional proxy path only if direct browser calls are blocked by CORS/auth
- [ ] Implement risk banner in sidebar using v1 multi-factor model from `config.js`:
  - swell height
  - wind speed
  - wind-relative direction
  - tide/current
- [ ] Show risk level (`safe`/`caution`/`danger`) plus plain-language reason

### 4) Static Deployment Baseline (`package.json`, GitHub Pages) 🔲
- [ ] Deploy working static build to GitHub Pages
- [ ] Confirm app starts, routes, and displays weather/tides in production
- [ ] Document required runtime config values in `README.md`

## MVP Acceptance Criteria

MVP is accepted when:
- [ ] User can plot a route with 2+ waypoints and see route drawn consistently
- [ ] User sees current swell/wind and tide data with source + timestamp
- [ ] User sees a risk banner with at least one reason when thresholds are exceeded
- [ ] If one provider fails, app either falls back or shows clear degraded-state messaging
- [ ] Same workflow works on GitHub Pages deploy without local-only assumptions

---

## Post-MVP Roadmap (Aligned to Modules)

### Phase A: Mapping Enhancements (`js/overlays.js`)
- [ ] Wind direction arrows/barbs overlay (Canvas or SVG layer)
- [ ] Tide/safety route segment color overlays on map

### Phase B: Forecast UX (`js/app.js`, `css/style.css`)
- [ ] Hourly panel (next 24h wind/swell timeline)
- [ ] Per-vessel presets and quick profile switching
- [ ] Save/load routes to `localStorage`

### Phase C: Interoperability + Offline (`index.html`, service worker files, build/deploy)
- [ ] Export GPX/KML for chartplotter import
- [ ] PWA shell caching (app assets + recent route metadata)
- [ ] Print-friendly route sheet (A4 PDF layout)

### Phase D: Cape Town Pack (`js/config.js`, `js/overlays.js`)
- [ ] Pre-load Cape Town harbour as default route
- [ ] SAWS synoptic chart overlay toggle
- [ ] Local tide stations (Cape Town, Saldanha, Mossel Bay)
- [ ] NSRI station locations as map markers

## Data Source Strategy

1. Define candidate providers by domain:
   - Tides (South Africa focus)
   - Marine weather/wind/waves
   - Optional chart overlays
2. For each provider, validate:
   - CORS behavior for browser requests
   - Terms/licensing for app display
   - Rate limits and uptime reliability
3. Implement adapter layer per provider in JS modules so UI is source-agnostic.
4. Add runtime fallback order and visible source attribution in sidebar.
5. Log provider failures in console with user-friendly banner in UI.

---
**Note:** Tooling/editor guidance is intentionally excluded from this plan and should be maintained in `README.md`.


I am still working on this
