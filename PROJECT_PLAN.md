# ⛵ Sailing Route Planner — Project Plan

## Vision

A clean, fast, offline-capable web app that lets sailors:
1. **Click waypoints** on a Leaflet map to define a route
2. **See tide data** overlaid on the route (high/low markers, colour-coded safety zones)
3. **Get marine weather** (wave height, swell, wind) from free APIs
4. **Receive warnings** when conditions exceed safe thresholds (e.g., swell > 3m)

No backend required. Everything runs in the browser. Deployable to GitHub Pages for free.

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
├── README.md               ← This file
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

---

## Build Steps

### Phase 1: Foundation ✅ (DONE)
- [x] Scaffold repo structure (`index.html`, `css/style.css`, `js/config.js`, `js/app.js`, `js/tides.js`)
- [x] Set up Leaflet map with OSM tiles
- [x] Add waypoint placement via map click
- [x] Add UI controls (Start/End/Route/Clear/Tides buttons)
- [x] Integrate OSRM for route calculation
- [x] Add marine data fetch from Open-Meteo (free, no key)
- [x] Dark nautical theme CSS
- [x] Responsive sidebar with route details + tide forecast

### Phase 2: Tide Overlay 🔲
- [ ] Parse tide-forecast.com or use NOAA CO-OPS (US) data
- [ ] Render tide table in sidebar (done, but needs live data source)
- [ ] Add serverless proxy (Vercel/Cloudflare Worker) for CORS-heavy sources
- [ ] Colour-code route segments: 🟢 safe (< 1.5m) / 🟡 caution (1.5–3m) / 🔴 danger (> 3m)

### Phase 3: Marine Weather Integration 🔲
- [ ] Fetch wind barbs data from Open-Meteo
- [ ] Overlay wind direction arrows on map (Canvas or SVG layer)
- [ ] Add hourly forecast panel (next 24h swell/wind timeline)
- [ ] Warning system: banner when conditions exceed `dangerSwellMeters` threshold

### Phase 4: Polish 🔲
- [ ] Save/load routes to `localStorage`
- [ ] Export GPX/KML for chartplotter import
- [ ] PWA manifest for offline use (cache API for tiles + JS)
- [ ] Print-friendly route sheet (A4 PDF layout)
- [ ] Deploy to GitHub Pages (`npm run deploy`)

### Phase 5: Cape Town Specific 🔲
- [ ] Pre-load Cape Town harbour as default route
- [ ] SAWS synoptic chart overlay toggle
- [ ] Local tide stations (Cape Town, Saldanha, Mossel Bay)
- [ ] NSRI station locations as map markers

---

## Recommended Vibe Coding IDE

### TL;DR: **VS Code + Continue extension**

| IDE | Price | Why / Why Not |
|-----|-------|---------------|
| **Cursor** | Free tier (limited) / $20/mo | Great AI IDE but overkill for a static HTML/JS project. Heavy, replaces your whole workflow. Good if you're building large apps daily. |
| **OpenCode** | Free (open source) | Solid, Claude-powered. Good balance. But needs manual setup + provider config. |
| **OpenCode Go** | $10/mo | Managed experience, great models. But paying $10/mo to scaffold a ~500-line static site is like hiring a yacht to cross a pond. |
| **VS Code + Continue** ⭐ | **Free** | Best fit for your setup. Here's why: |

### Why VS Code + Continue wins for this project:

1. **You already use OpenRouter** — Continue extension plugs directly into your existing `OPENROUTER_API_KEY`, with model dropdown (switch between free/paid in one click)
2. **Cost: zero** — VS Code is free, Continue is free, OpenRouter free-tier models work fine for incremental edits
3. **Agentic coding** — Continue's `/edit` and `/code` commands let you describe changes in natural language and apply them inline — perfect for "add tide polygon overlay to route segments"
4. **Git integrated** — Built-in terminal + Git GUI, you can commit/push without leaving the editor
5. **Lightweight** — No Electron bloat, starts instantly, works on your Mac Mini Linux box
6. **Long-term value** — When you build the leather/silver crafting e-commerce site later (or whatever else), it's already there. Not locked into a vibe-coding-only tool

### Quick Setup:

```bash
# Install if not already
sudo apt install code

# In VS Code: Extensions → search "Continue" → Install
# Then: Continue → Settings → Add OpenRouter API key
# Model: deepseek/deepseek-v4-pro (your existing key)
```

### Workflow for this project:
```
1. Open sailing-route-planner/ in VS Code
2. Select text you want to change
3. Cmd+I (or Ctrl+I) → Describe what you want
4. Continue generates the edit → Accept or iterate
5. Built-in terminal: npm start → test in browser
```

---

**When Cursor *would* make sense:** If you start building the full e-commerce platform for leather/silver products (React/Node/DB) — that's when a full AI IDE with multi-file context shines. For now, Keep It Simple. 🧭