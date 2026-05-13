// ── Configuration ──────────────────────────────────────────────────────
// Toggle data sources here. All are free / no-key-required endpoints.

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
  routeWeight: 4,
  waypointColor: '#3b82f6',
  dangerSwellMeters: 3.0,  // Waves above this trigger warnings
};

// ── Marine & Tide Fetch Module ──────────────────────────────────────────
// All API calls go through a single gateway function so you can swap
// providers later without touching the rest of the codebase.

async function fetchMarineData({ lat, lon, days = 3 }) {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: 'wave_height,wave_direction,wind_wave_height,swell_wave_height,wave_period,wind_speed_10m',
    daily: 'wave_height_max,wave_direction_dominant,swell_wave_height_max,swell_wave_period_max',
    timezone: 'Africa/Johannesburg',
    start_date: today,
    end_date: end,
  });

  const resp = await fetch(`${CONFIG.marineApi}?${params}`);
  if (!resp.ok) throw new Error(`Marine API error: ${resp.status}`);
  return resp.json();
}

async function fetchTides({ lat, lon }) {
  // Fallback: parse tide-forecast.com for Cape Town
  // Primary: use Open-Meteo's free tide model (no key)
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    timezone: 'Africa/Johannesburg',
  });

  try {
    const resp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=Cape+Town&count=1&language=en&format=json`);
    if (resp.ok) {
      const geo = await resp.json();
      if (geo.results?.[0]) {
        params.set('latitude', geo.results[0].latitude);
        params.set('longitude', geo.results[0].longitude);
      }
    }
  } catch (_) { /* use default coords */ }

  // Note: Open-Meteo has a tide endpoint but it's behind a paid tier for some params.
  // For now, we fall back to scraping tide-forecast.com via a CORS proxy or
  // a simple serverless function you can deploy.
  console.log('Tide fetch needs a server-side proxy — see README for setup');
  return null;
}

// ── Waypoint & Route Manager ────────────────────────────────────────────

class RouteManager {
  constructor(map) {
    this.map = map;
    this.waypoints = [];
    this.routeLine = null;
    this.markers = [];
    this.routingControl = null;
  }

  addWaypoint(latlng) {
    const idx = this.waypoints.length;
    this.waypoints.push(latlng);

    const marker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'waypoint-label',
        html: String.fromCharCode(65 + idx), // A, B, C...
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    }).addTo(map);

    this.markers.push(marker);
    if (this.waypoints.length >= 2) this.calculateRoute();
  }

  async calculateRoute() {
    // Leaflet Routing Machine uses OSRM / Valhalla / Mapbox by default
    // For offline / free: use OSRM demo server
    if (this.routingControl) {
      this.map.removeControl(this.routingControl);
    }

    this.routingControl = L.Routing.control({
      waypoints: this.waypoints.map(w => L.latLng(w)),
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
      }),
      lineOptions: {
        styles: [{ color: CONFIG.routeColor, weight: CONFIG.routeWeight, opacity: 0.8 }],
      },
      show: false,
      addWaypoints: false,
    }).addTo(this.map);

    this.routingControl.on('routesfound', (e) => {
      const route = e.routes[0];
      document.getElementById('route-details').innerHTML = `
        <p><strong>Distance:</strong> ${(route.summary.totalDistance / 1000).toFixed(1)} km</p>
        <p><strong>Est. time:</strong> ${Math.round(route.summary.totalTime / 60)} min</p>
        <p><strong>Waypoints:</strong> ${this.waypoints.length}</p>
      `;
    });
  }

  clear() {
    this.waypoints = [];
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];
    if (this.routingControl) {
      this.map.removeControl(this.routingControl);
      this.routingControl = null;
    }
    document.getElementById('route-details').innerHTML =
      '<p class="muted">Click the map to set waypoints.</p>';
  }
}

// ── Map Init ────────────────────────────────────────────────────────────

const map = L.map('map', CONFIG.map).setView(CONFIG.map.center, CONFIG.map.zoom);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: CONFIG.map.maxZoom,
}).addTo(map);

// Nautical-style dark tile layer option (uncomment to use)
// L.tileLayer('https://tiles.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
//   attribution: '© CARTO',
// }).addTo(map);

const routeManager = new RouteManager(map);

// ── Tide overlay layer ─────────────────────────────────────────────────
// TODO: Render tide height as coloured polygons along the route.
// Green = safe (< 1.5m), Yellow = caution (1.5–3.0m), Red = danger (> 3.0m)

// ── UI Event Handlers ───────────────────────────────────────────────────

let mode = 'start'; // 'start' | 'end'

document.getElementById('btn-set-start').addEventListener('click', () => {
  mode = 'start';
  document.getElementById('btn-set-start').classList.add('btn-accent');
  document.getElementById('btn-set-end').classList.remove('btn-accent');
  document.getElementById('btn-set-end').classList.add('btn-secondary');
});

document.getElementById('btn-set-end').addEventListener('click', () => {
  mode = 'end';
  document.getElementById('btn-set-end').classList.add('btn-accent');
  document.getElementById('btn-set-start').classList.remove('btn-accent');
  document.getElementById('btn-set-start').classList.add('btn-primary');
});

document.getElementById('btn-clear').addEventListener('click', () => {
  routeManager.clear();
});

document.getElementById('btn-route').addEventListener('click', async () => {
  if (routeManager.waypoints.length < 2) {
    alert('Set at least 2 waypoints first!');
    return;
  }

  // Fetch marine data for the route bbox
  const bounds = map.getBounds();
  const center = bounds.getCenter();

  try {
    const marine = await fetchMarineData({
      lat: center.lat,
      lon: center.lng,
      days: 1,
    });

    if (marine && marine.daily) {
      const today = marine.daily.time.indexOf(
        new Date().toISOString().slice(0, 10)
      );
      if (today >= 0) {
        const swell = marine.daily.swell_wave_height_max[today];
        document.getElementById('route-details').innerHTML += `
          <hr style="border-color:#1e293b;margin:8px 0">
          <p><strong>Today's max swell:</strong> ${swell}m</p>
          ${swell > CONFIG.dangerSwellMeters
            ? '<p style="color:#ef4444">⚠️ Heavy swell — caution for small craft!</p>'
            : '<p style="color:#22c55e">🟢 Manageable swell conditions</p>'}
        `;
      }
    }
  } catch (err) {
    console.error('Marine fetch failed:', err);
  }
});

map.on('click', (e) => {
  routeManager.addWaypoint(e.latlng);
});

// ── Init sidebar with loading state ──────────────────────────────────────
document.getElementById('tide-forecast').innerHTML =
  '<p class="muted">Tide overlay requires a server-side proxy — see README.</p>';
document.getElementById('tide-info').textContent = 'Tides: initializing...';